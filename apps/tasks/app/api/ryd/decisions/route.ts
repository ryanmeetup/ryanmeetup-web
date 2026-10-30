import { NextResponse } from "next/server";
import { rydBulkDecisionSchema } from "@/lib/api-schema";
import { RYD_DECISION_BODY_BYTES } from "@/lib/ryd/bulk-operations";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { reviewRydOrders, rydMutationFailure } from "@/lib/server/ryd-mutations";

export async function POST(request: Request) {
  const context = await rydContext();
  if ("response" in context) return context.response;
  const parsed = await readJson(request, rydBulkDecisionSchema, {
    maxBytes: RYD_DECISION_BODY_BYTES,
  });
  if ("response" in parsed) return parsed.response;
  try {
    return NextResponse.json(
      await reviewRydOrders(context.admin, context.user.id, parsed.data.decisions),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.decisions",
      error,
      "Those decisions could not be saved. Try again.",
    );
  }
}
