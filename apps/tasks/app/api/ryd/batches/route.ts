import { NextResponse } from "next/server";
import { rydBatchSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { generateRydFulfillment } from "@/lib/server/ryd-fulfillment";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";
import { RYD_FULFILLMENT_BODY_BYTES } from "@/lib/ryd/fulfillment";

export async function POST(request: Request) {
  const parsed = await readJson(request, rydBatchSchema, {
    maxBytes: RYD_FULFILLMENT_BODY_BYTES,
  });
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    return NextResponse.json(
      await generateRydFulfillment(
        context.admin,
        context.user.id,
        parsed.data.orderIds,
      ),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.batch",
      error,
      "The batch could not be updated. Try again.",
    );
  }
}
