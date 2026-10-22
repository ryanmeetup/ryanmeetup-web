import "server-only";

import { zonedParts } from "@/lib/digest/digest-settings";
import { errorMessage } from "@/lib/presentation";
import { isRydUploadReminderSlot } from "@/lib/ryd/upload-reminder";
import { getAdminClient } from "./admin-client";
import { readDigestSettings } from "./digest-settings";
import { getInstanceSettings } from "./instance-settings";
import { loadRydSettings } from "./ryd";
import { sendRydUploadReminderEmail } from "./ryd-upload-reminder-email";
import { isMissingColumn, isMissingRelation } from "./supabase-errors";

export type RydUploadReminderResult = {
  outcome:
    | "sent"
    | "off_schedule"
    | "already_sent"
    | "disabled"
    | "unconfigured"
    | "failed";
  /** The workspace-local date of the slot, when there was one. */
  slotDate: string | null;
  sent: number;
  failed: number;
  detail: string | null;
};

const senderAddress = () =>
  process.env.TASK_DIGEST_FROM_EMAIL ??
  process.env.TASK_REMINDER_FROM_EMAIL ??
  process.env.RESEND_FROM_EMAIL;

/**
 * Email everyone who can open RY-D Verification to upload this week's orders.
 *
 * Invoked hourly; the slot on the RY-D settings row decides which hour sends,
 * in the workspace's digest time zone. The slot is claimed on the settings
 * row before anything goes out, so overlapping runs send it once, and each
 * message carries an idempotency key besides. A run where every send failed
 * gives the claim back, so a retry inside the slot's hour can try again.
 */
export async function runRydUploadReminder({
  now = new Date(),
}: { now?: Date } = {}): Promise<RydUploadReminderResult> {
  const result = (
    outcome: RydUploadReminderResult["outcome"],
    slotDate: string | null = null,
    detail: string | null = null,
    sent = 0,
    failed = 0,
  ): RydUploadReminderResult => ({ outcome, slotDate, sent, failed, detail });

  if (!(await getInstanceSettings()).rydEnabled)
    return result("disabled", null, "RY-D Verification is off.");
  const admin = getAdminClient();
  if (!admin)
    return result(
      "unconfigured",
      null,
      "Supabase admin credentials are missing.",
    );

  let settings;
  try {
    settings = await loadRydSettings(admin);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (isMissingRelation(code))
      return result("unconfigured", null, "The RY-D tables don't exist yet.");
    return result("failed", null, errorMessage(error, "Settings unreadable."));
  }
  if (!settings.uploadReminder.enabled)
    return result("disabled", null, "The upload reminder is off.");
  const { timeZone } = await readDigestSettings(admin);
  if (!isRydUploadReminderSlot(settings.uploadReminder, timeZone, now))
    return result("off_schedule");
  const slotDate = zonedParts(now, timeZone).date;

  const apiKey = process.env.RESEND_API_KEY;
  const from = senderAddress();
  if (!apiKey || !from)
    return result(
      "unconfigured",
      slotDate,
      "RESEND_API_KEY or a verified sender address is missing.",
    );

  // The singleton may not exist yet when nobody has saved settings; the
  // defaults still remind.
  const ensured = await admin
    .from("ryd_settings")
    .upsert({ id: true }, { onConflict: "id", ignoreDuplicates: true });
  if (ensured.error) return result("failed", slotDate, ensured.error.message);
  const previous = await admin
    .from("ryd_settings")
    .select("upload_reminder_sent_on")
    .maybeSingle();
  if (previous.error)
    return result(
      isMissingColumn(previous.error.code) ? "unconfigured" : "failed",
      slotDate,
      previous.error.message,
    );
  const claim = await admin
    .from("ryd_settings")
    .update({ upload_reminder_sent_on: slotDate })
    .or(
      `upload_reminder_sent_on.is.null,upload_reminder_sent_on.neq.${slotDate}`,
    )
    .select("id");
  if (claim.error) return result("failed", slotDate, claim.error.message);
  if (!claim.data?.length) return result("already_sent", slotDate);

  const [members, pending, needsInfo] = await Promise.all([
    admin.rpc("workspace_area_members", { requested_area: "ryd" }),
    admin
      .from("ryd_orders")
      .select("order_id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("cleared_batch_id", null),
    admin
      .from("ryd_orders")
      .select("order_id", { count: "exact", head: true })
      .eq("status", "needs_info")
      .is("cleared_batch_id", null),
  ]);
  const readFailure = members.error ?? pending.error ?? needsInfo.error;
  if (readFailure) {
    await releaseClaim(
      admin,
      slotDate,
      previous.data?.upload_reminder_sent_on ?? null,
    );
    return result("failed", slotDate, readFailure.message);
  }
  // A set-returning scalar comes back as bare values or as rows named after
  // the function, depending on the PostgREST version.
  const memberIds = ((members.data ?? []) as unknown[]).map((row) =>
    typeof row === "string"
      ? row
      : (row as { workspace_area_members: string }).workspace_area_members,
  );
  const profiles = memberIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", memberIds)
    : { data: [], error: null };
  if (profiles.error) {
    await releaseClaim(
      admin,
      slotDate,
      previous.data?.upload_reminder_sent_on ?? null,
    );
    return result("failed", slotDate, profiles.error.message);
  }

  const instance = await getInstanceSettings();
  const counts = {
    pending: pending.count ?? 0,
    needsInfo: needsInfo.count ?? 0,
  };
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const profile of profiles.data ?? []) {
    const user = await admin.auth.admin.getUserById(profile.id);
    const to = user.data.user?.email;
    if (!to) {
      failed += 1;
      lastError = `No email address for ${profile.full_name}.`;
      continue;
    }
    try {
      await sendRydUploadReminderEmail({
        to,
        recipientName: profile.full_name,
        counts,
        instance,
        idempotencyKey: `ryd-upload-reminder/${profile.id}/${slotDate}`,
        from,
        apiKey,
      });
      sent += 1;
    } catch (error) {
      lastError = errorMessage(error, "Unknown send error");
      console.error("[ryd-upload-reminder.send]", {
        profileId: profile.id,
        message: lastError,
      });
      failed += 1;
    }
  }

  if (!sent && failed) {
    await releaseClaim(
      admin,
      slotDate,
      previous.data?.upload_reminder_sent_on ?? null,
    );
    return result("failed", slotDate, lastError, sent, failed);
  }
  return result(
    "sent",
    slotDate,
    sent ? (failed ? lastError : null) : "Nobody can open RY-D Verification.",
    sent,
    failed,
  );
}

async function releaseClaim(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  slotDate: string,
  previous: string | null,
) {
  const released = await admin
    .from("ryd_settings")
    .update({ upload_reminder_sent_on: previous })
    .eq("id", true)
    .eq("upload_reminder_sent_on", slotDate);
  if (released.error)
    console.error("[ryd-upload-reminder.release]", released.error.message);
}
