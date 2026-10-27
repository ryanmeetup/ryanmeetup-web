import { NextResponse } from "next/server";
import { rydSettingsSchema } from "@/lib/api-schema";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";
import { readJson } from "@/lib/server/request";
import { rydSettingsFrom, rydContext } from "@/lib/server/ryd";

/**
 * Which form buyers verify through, who receives the finished file, and when
 * everyone is reminded to upload fulfillment's orders.
 */
export async function PATCH(request: Request) {
  const parsed = await readJson(request, rydSettingsSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext({ settings: true });
  if ("response" in context) return context.response;

  const row: Record<string, unknown> = {
    id: true,
    updated_at: new Date().toISOString(),
    updated_by: context.user.id,
  };
  if (parsed.data.formId !== undefined) row.form_id = parsed.data.formId;
  if (parsed.data.fulfillmentEmail !== undefined)
    row.fulfillment_email = parsed.data.fulfillmentEmail;
  if (parsed.data.uploadReminder) {
    row.upload_reminder_enabled = parsed.data.uploadReminder.enabled;
    row.upload_reminder_weekday = parsed.data.uploadReminder.weekday;
    row.upload_reminder_hour = parsed.data.uploadReminder.hour;
  }
  const result = await context.admin
    .from("ryd_settings")
    .upsert(row)
    .select("*")
    .single();
  if (result.error)
    return rydMutationFailure(
      request,
      "ryd.settings",
      result.error,
      "The settings could not be saved. Try again.",
    );
  return NextResponse.json(rydSettingsFrom(result.data));
}
