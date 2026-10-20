import { NextResponse } from "next/server";
import { isAllowedTasksRequestOrigin } from "@/lib/app-url";
import { apiError, databaseFailure } from "@/lib/server/api-response";
import { importRydOrders, rydContext } from "@/lib/server/ryd";

/** A week of orders is a few kilobytes; this leaves room for a busy month. */
const MAX_CSV_BYTES = 2 * 1024 * 1024;

/**
 * Upload fulfillment's order file. It arrives as multipart form data rather
 * than JSON, so the origin and size checks `readJson` makes are made here.
 */
export async function POST(request: Request) {
  let originAllowed = false;
  try {
    originAllowed = isAllowedTasksRequestOrigin(request.headers.get("origin"));
  } catch {
    // Invalid application URL configuration is handled as a rejected origin.
  }
  if (!originAllowed)
    return apiError(
      403,
      "ORIGIN_REJECTED",
      "This request did not come from the Tasks app.",
    );
  const context = await rydContext();
  if ("response" in context) return context.response;

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_CSV_BYTES)
    return apiError(413, "REQUEST_TOO_LARGE", "That file is too large.");
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    // Handled below as a missing file.
  }
  if (!(file instanceof File))
    return apiError(400, "INVALID_REQUEST", "Choose the order CSV to upload.");
  if (file.size > MAX_CSV_BYTES)
    return apiError(413, "REQUEST_TOO_LARGE", "That file is too large.");

  try {
    const result = await importRydOrders(
      context.admin,
      context.user,
      file.name,
      await file.text(),
    );
    if (!result.ok) return apiError(400, "INVALID_REQUEST", result.error);
    return NextResponse.json(result);
  } catch (error) {
    return databaseFailure(
      request,
      "ryd.import",
      error as { code?: string; message?: string },
      { error: "The orders could not be imported. Try again." },
    );
  }
}
