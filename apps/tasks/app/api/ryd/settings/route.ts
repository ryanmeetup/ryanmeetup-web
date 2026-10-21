import { NextResponse } from "next/server";
import { rydSettingsSchema } from "@/lib/api-schema";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";
import { readJson } from "@/lib/server/request";
import { loadRydSettings, rydContext } from "@/lib/server/ryd";

/** Which form buyers verify through, and who receives the finished file. */
export async function PATCH(request: Request) {
  const parsed = await readJson(request, rydSettingsSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;

  const row: Record<string, unknown> = {
    id: true,
    updated_at: new Date().toISOString(),
    updated_by: context.user.id,
  };
  if (parsed.data.formId !== undefined) row.form_id = parsed.data.formId;
  if (parsed.data.fulfillmentEmail !== undefined)
    row.fulfillment_email = parsed.data.fulfillmentEmail;
  const result = await context.admin.from("ryd_settings").upsert(row);
  if (result.error)
    return rydMutationFailure(request, "ryd.settings", result.error, "The settings could not be saved. Try again.");
  return NextResponse.json(await loadRydSettings(context.admin));
}
