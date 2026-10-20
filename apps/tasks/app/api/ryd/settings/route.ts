import { NextResponse } from "next/server";
import { rydSettingsSchema } from "@/lib/api-schema/ryd";
import { databaseFailure } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { loadRydSettings, rydContext } from "@/lib/server/ryd";

/** Which sheet holds the form responses, and who receives the finished file. */
export async function PATCH(request: Request) {
  const parsed = await readJson(request, rydSettingsSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext({ owner: true });
  if ("response" in context) return context.response;

  const row: Record<string, unknown> = {
    id: true,
    updated_at: new Date().toISOString(),
    updated_by: context.user.id,
  };
  if (parsed.data.formSheetId !== undefined)
    row.form_sheet_id = parsed.data.formSheetId;
  if (parsed.data.fulfillmentEmail !== undefined)
    row.fulfillment_email = parsed.data.fulfillmentEmail;
  const result = await context.admin.from("ryd_settings").upsert(row);
  if (result.error)
    return databaseFailure(request, "ryd.settings", result.error, {
      error: "The settings could not be saved. Try again.",
    });
  return NextResponse.json(await loadRydSettings(context.admin));
}
