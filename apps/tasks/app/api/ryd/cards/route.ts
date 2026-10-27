import { NextResponse } from "next/server";
import { rydCardBatchSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { createRydCardBatch } from "@/lib/server/ryd-card-batches";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";

/**
 * Pull the next card file: every verified order with an approved card that
 * is still ready to send, marked sent to fulfillment in the same transaction.
 * A retry with the same operation returns the same batch.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydCardBatchSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    return NextResponse.json(
      await createRydCardBatch(
        context.admin,
        context.user.id,
        parsed.data.operationId,
      ),
    );
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.cards",
      error,
      "The cards couldn't be pulled. Try again.",
    );
  }
}
