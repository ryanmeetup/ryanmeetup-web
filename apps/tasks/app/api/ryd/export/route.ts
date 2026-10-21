import { parseUuid } from "@/lib/api-schema";
import { apiError } from "@/lib/server/api-response";
import { rydContext } from "@/lib/server/ryd";
import { rydFulfillmentCsv } from "@/lib/server/ryd-fulfillment";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";

/** Download the exact prepared file; never rebuild it from the live queue. */
export async function GET(request: Request) {
  const context = await rydContext();
  if ("response" in context) return context.response;
  const id = parseUuid(new URL(request.url).searchParams.get("batch"));
  if (!id)
    return apiError(
      400,
      "INVALID_REQUEST",
      "Prepare a fulfillment batch before downloading its file.",
    );
  try {
    const csv = await rydFulfillmentCsv(context.admin, id);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="ry-d-batch-${id}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.export",
      error,
      "The file could not be built. Try again.",
    );
  }
}
