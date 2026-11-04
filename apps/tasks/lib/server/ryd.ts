import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  RYD_DONE_WINDOW_DAYS,
  type RydQueue,
  type RydSettings,
  type RydSheetState,
} from "@/lib/ryd/queue-types";
import { type RydSubmission } from "@/lib/ryd/matching";
import {
  rydUploadDueSince,
  rydUploadReminderFrom,
} from "@/lib/ryd/upload-reminder";
import { withRydQueueMatches } from "@/lib/ryd/queue-reconciliation";
import { rydCardDraft, savedRydCard } from "@/lib/ryd/card";
import { rydOrderCell, type RydOrderStatus } from "@/lib/ryd/orders";
import { getAdminClient } from "./admin-client";
import { apiError, forbidden, notFound } from "./api-response";
import { authorize } from "./auth";
import { readDigestSettings } from "./digest-settings";
import { getInstanceSettings } from "./instance-settings";
import {
  loadRydGoogleIntegration,
  readRydSubmissions,
  type RydGoogleReadOptions,
  type RydGoogleIntegrationRow,
} from "./ryd-google";
import { readRydLinks, readRydRows } from "./ryd-queries";

export type RydContext = {
  user: User;
  supabase: SupabaseClient;
  admin: SupabaseClient;
};

/**
 * The gate every RY-D route passes. An instance with RY-D off answers 404, as
 * if the page never existed; a member without the page answers 403. Data is
 * then read with the service role, because the tables carry no user policies.
 * Page access grants the queue. Changing settings or the Google connection
 * also needs the separately locked RY-D Settings page: pass `settings`.
 */
export async function rydContext({
  settings = false,
}: { settings?: boolean } = {}): Promise<RydContext | { response: Response }> {
  if (!(await getInstanceSettings()).rydEnabled)
    return { response: notFound() };
  const authorization = await authorize({
    onboarded: true,
    area: "ryd",
  });
  if ("response" in authorization) return authorization;
  if (settings) {
    // Fails closed: an error is not permission.
    const { data, error } = await authorization.supabase.rpc(
      "can_view_workspace_area",
      { requested_area: "ryd-settings" },
    );
    if (error || data !== true) return { response: forbidden() };
  }
  const admin = getAdminClient();
  if (!admin)
    return {
      response: apiError(
        503,
        "SERVICE_UNAVAILABLE",
        "RY-D Verification is unavailable.",
      ),
    };
  return { ...authorization, admin };
}

export type RydOrderRow = {
  order_id: string;
  sales_order: string;
  ordered_at: string;
  first_name: string;
  last_name: string;
  email: string;
  raw: Record<string, string>;
  status: RydOrderStatus;
  note: string | null;
  decided_at: string | null;
  decided_by: string | null;
  cleared_batch_id: string | null;
  last_emailed_at: string | null;
  production_sent_at: string | null;
  done_at: string | null;
  /** NULL until a card is saved. */
  card_first_name: string | null;
  card_last_name: string | null;
  card_location: string | null;
  card_ryan_since: string | null;
  created_at: string;
  updated_at: string;
};

const ORDER_COLUMNS = [
  "order_id",
  "sales_order",
  "ordered_at",
  "first_name",
  "last_name",
  "email",
  "raw",
  "status",
  "note",
  "decided_at",
  "decided_by",
  "cleared_batch_id",
  "last_emailed_at",
  "production_sent_at",
  "done_at",
  "card_first_name",
  "card_last_name",
  "card_location",
  "card_ryan_since",
  "created_at",
  "updated_at",
].join(", ");

/** The card an order shows: what was saved, else the export's draft. */
export function rydQueueCard(row: RydOrderRow) {
  const draft = rydCardDraft(row.raw, {
    firstName: row.first_name,
    lastName: row.last_name,
  });
  const saved = savedRydCard(row);
  return {
    card: saved ?? draft.card,
    cardSaved: Boolean(saved),
    cardHint: draft.hint,
  };
}

export async function loadRydSettings(
  admin: SupabaseClient,
): Promise<RydSettings> {
  const result = await admin
    .from("ryd_settings")
    // Everything, so this still reads before the reminder columns exist.
    .select("*")
    .maybeSingle();
  if (result.error) throw result.error;
  return rydSettingsFrom(result.data);
}

export function rydSettingsFrom(
  row: Record<string, unknown> | null,
): RydSettings {
  return {
    formId: (row?.form_id as string | null) ?? null,
    fulfillmentEmail: (row?.fulfillment_email as string | null) ?? null,
    uploadReminder: rydUploadReminderFrom(row),
  };
}

async function loadSheet(
  integration: RydGoogleIntegrationRow | null,
  settings: RydSettings,
  options: RydGoogleReadOptions,
): Promise<{ sheet: RydSheetState; submissions: RydSubmission[] }> {
  if (!integration)
    return { sheet: { status: "disconnected" }, submissions: [] };
  if (!settings.formId)
    return {
      sheet: {
        status: "unconfigured",
        accountEmail: integration.account_email,
      },
      submissions: [],
    };
  try {
    const { submissions, warnings } = await readRydSubmissions(
      integration,
      settings.formId,
      options,
    );
    return {
      sheet: {
        status: "ok",
        accountEmail: integration.account_email,
        ...(warnings?.length ? { warnings } : {}),
      },
      submissions,
    };
  } catch (error) {
    options.signal?.throwIfAborted();
    // The queue still works without the form: decisions, notes, and the
    // export only need the orders. The page says why the evidence is missing.
    console.error("RY-D form could not be read", error);
    return {
      sheet: {
        status: "error",
        accountEmail: integration.account_email,
        message:
          error instanceof Error && error.message.startsWith("The ")
            ? error.message
            : `Google wouldn't share the form's responses with ${integration.account_email}. Check the form link, and that this account owns or can edit the form.`,
      },
      submissions: [],
    };
  }
}

/** Keys of the responses someone set aside. */
async function loadDismissedKeys(admin: SupabaseClient) {
  const result = await readRydRows((from, to) =>
    admin
      .from("ryd_dismissed_submissions")
      .select("submission_key")
      .order("submission_key")
      .range(from, to),
  );
  if (result.error) throw result.error;
  return new Set((result.data ?? []).map((row) => row.submission_key));
}

/** Contact attempts per submitter email, folded from one row per attempt. */
async function loadSubmitterContacts(admin: SupabaseClient) {
  const result = await readRydRows((from, to) =>
    admin
      .from("ryd_submitter_contacts")
      .select("email, contacted_at")
      .order("id")
      .range(from, to),
  );
  if (result.error) throw result.error;
  const contacts: RydQueue["contacts"] = {};
  for (const row of (result.data ?? []) as {
    email: string;
    contacted_at: string;
  }[]) {
    const contact = contacts[row.email];
    contacts[row.email] = {
      attempts: (contact?.attempts ?? 0) + 1,
      lastContactedAt:
        contact && contact.lastContactedAt > row.contacted_at
          ? contact.lastContactedAt
          : row.contacted_at,
    };
  }
  return contacts;
}

/**
 * Everything still open, every verified order (sent to fulfillment or not, so
 * its production can be tracked), the live form responses, and a suggested
 * pairing for every order nobody has paired yet. Orders marked done more than
 * `RYD_DONE_WINDOW_DAYS` ago are only counted unless `olderDone` asks for them.
 */
export async function loadRydQueue(
  admin: SupabaseClient,
  {
    olderDone = false,
    ...options
  }: RydGoogleReadOptions & { olderDone?: boolean } = {},
): Promise<RydQueue> {
  const before = olderDone
    ? null
    : new Date(Date.now() - RYD_DONE_WINDOW_DAYS * 86_400_000).toISOString();
  const [ordersResult, linksResult, importResult, olderResult] =
    await Promise.all([
      readRydRows((from, to) => {
        const query = admin
          .from("ryd_orders")
          .select(ORDER_COLUMNS)
          .or("cleared_batch_id.is.null,status.eq.verified");
        return (
          before ? query.or(`done_at.is.null,done_at.gte.${before}`) : query
        )
          .order("created_at", { ascending: false })
          .order("order_id")
          .range(from, to);
      }),
      readRydLinks(admin),
      admin
        .from("ryd_imports")
        .select("uploaded_at")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      before
        ? admin
            .from("ryd_orders")
            .select("order_id", { count: "exact", head: true })
            .lt("done_at", before)
        : null,
    ]);
  const failure =
    ordersResult.error ??
    linksResult.error ??
    importResult.error ??
    olderResult?.error;
  if (failure) throw failure;
  const [settings, integration, dismissedKeys, contacts, digest] =
    await Promise.all([
      loadRydSettings(admin),
      loadRydGoogleIntegration(),
      loadDismissedKeys(admin),
      loadSubmitterContacts(admin),
      readDigestSettings(admin),
    ]);
  const { sheet, submissions: answered } = await loadSheet(
    integration,
    settings,
    options,
  );
  // A set-aside response drops out of matching and every list. One linked
  // since keeps its place on the order.
  const linkedKeys = new Set(
    (linksResult.data ?? []).map((link) => link.submission_key),
  );
  const isDismissed = (key: string) =>
    dismissedKeys.has(key) && !linkedKeys.has(key);
  const submissions = answered.filter((s) => !isDismissed(s.key));
  const dismissed = answered.filter((s) => isDismissed(s.key));

  const linkedByOrder = new Map<string, string[]>();
  for (const link of linksResult.data ?? []) {
    const keys = linkedByOrder.get(link.order_id) ?? [];
    keys.push(link.submission_key);
    linkedByOrder.set(link.order_id, keys);
  }
  const rows = (ordersResult.data ?? []) as unknown as RydOrderRow[];

  return withRydQueueMatches({
    submissionClaims: Object.fromEntries(
      (linksResult.data ?? []).map((link) => [
        link.submission_key,
        link.order_id,
      ]),
    ),
    orders: rows.map((row) => ({
      ...rydQueueCard(row),
      orderId: row.order_id,
      salesOrder: row.sales_order,
      orderedAt: row.ordered_at,
      firstName: row.first_name,
      lastName: row.last_name,
      displayEmail: rydOrderCell(row.raw, "email").trim() || row.email,
      email: row.email,
      total: rydOrderCell(row.raw, "total"),
      status: row.status,
      note: row.note,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
      updatedAt: row.updated_at,
      lastEmailedAt: row.last_emailed_at,
      sentToFulfillment: Boolean(row.cleared_batch_id),
      productionSentAt: row.production_sent_at,
      doneAt: row.done_at,
      linkedKeys: linkedByOrder.get(row.order_id) ?? [],
      suggestion: null,
    })),
    submissions,
    dismissed,
    contacts,
    sheet,
    settings,
    timeZone: digest.timeZone,
    uploadDueSince: rydUploadDueSince(
      settings.uploadReminder,
      digest.timeZone,
      importResult.data?.uploaded_at ?? null,
      new Date(),
    ),
    olderDone: before ? { before, count: olderResult?.count ?? 0 } : null,
  });
}
