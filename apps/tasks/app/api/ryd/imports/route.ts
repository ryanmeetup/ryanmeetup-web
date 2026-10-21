import { NextResponse } from "next/server";
import { parseUuid } from "@/lib/api-schema";
import { isAllowedTasksRequestOrigin } from "@/lib/app-url";
import { apiError } from "@/lib/server/api-response";
import { rydContext } from "@/lib/server/ryd";
import { importRydOrders } from "@/lib/server/ryd-import";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_CSV_BYTES + 64 * 1024;

/** Bound bytes before multipart parsing, including untrusted chunked uploads. */
export async function POST(request: Request) {
  let originAllowed = false;
  try {
    originAllowed = isAllowedTasksRequestOrigin(request.headers.get("origin"));
  } catch {
    /* Reject invalid app URL configuration. */
  }
  if (!originAllowed)
    return apiError(
      403,
      "ORIGIN_REJECTED",
      "This request did not come from the Tasks app.",
    );
  const context = await rydContext();
  if ("response" in context) return context.response;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    return apiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Upload the order CSV as form data.",
    );
  const tooLarge = () =>
    apiError(413, "REQUEST_TOO_LARGE", "That file is too large.");
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    return tooLarge();
  const reader = request.body?.getReader();
  if (!reader)
    return apiError(400, "INVALID_REQUEST", "Choose the order CSV to upload.");
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  let form: FormData;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return tooLarge();
      }
      chunks.push(value.slice().buffer);
    }
    form = await new Response(new Blob(chunks), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    return apiError(
      400,
      "INVALID_REQUEST",
      "That upload could not be read. Choose the CSV and try again.",
    );
  } finally {
    reader.releaseLock();
  }
  const file = form.get("file");
  const operationId = parseUuid(form.get("operationId"));
  if (!(file instanceof File) || !operationId || [...form.keys()].length !== 2)
    return apiError(
      400,
      "INVALID_REQUEST",
      "Choose the order CSV and start a valid upload.",
    );
  if (file.size > MAX_CSV_BYTES) return tooLarge();
  try {
    const result = await importRydOrders(
      context.admin,
      context.user.id,
      operationId,
      file.name,
      await file.text(),
    );
    if (!result.ok) return apiError(400, "INVALID_REQUEST", result.error);
    return NextResponse.json(result);
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.import",
      error,
      "The orders could not be imported. Try again.",
    );
  }
}
