import { parseUuid } from "@/lib/api-schema";
import { apiError, notFound } from "@/lib/server/api-response";
import { rydContext } from "@/lib/server/ryd";
import { rydCardBatchFile } from "@/lib/server/ryd-card-batches";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";

/** Download a batch exactly as it was pulled; downloading never marks orders. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const context = await rydContext();
  if ("response" in context) return context.response;
  const id = parseUuid((await params).batchId);
  if (!id) return apiError(400, "INVALID_REQUEST", "Choose a card batch.");
  try {
    const file = await rydCardBatchFile(context.admin, id);
    if (!file) return notFound();
    return new Response(file.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${file.filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.cards.download",
      error,
      "The card file couldn't be built. Try again.",
    );
  }
}
