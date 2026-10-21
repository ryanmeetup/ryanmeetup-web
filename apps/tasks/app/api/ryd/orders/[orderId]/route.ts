import { NextResponse } from "next/server";
import { rydDecisionSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { reviewRydOrder, rydMutationFailure } from "@/lib/server/ryd-mutations";

/** The decision, accepted suggestions, and audit events commit together. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const parsed = await readJson(request, rydDecisionSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  const { orderId } = await params;
  const { submissionKeys = [], ...patch } = parsed.data;
  try {
    return NextResponse.json(
      await reviewRydOrder(
        context.admin,
        context.user.id,
        orderId,
        patch,
        submissionKeys,
      ),
    );
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.decide",
      error,
      "The decision could not be saved. Try again.",
    );
  }
}
