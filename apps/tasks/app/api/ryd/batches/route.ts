import { NextResponse } from "next/server";
import { rydBatchSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import {
  finishRydFulfillment,
  prepareRydFulfillment,
} from "@/lib/server/ryd-fulfillment";
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
    const data = parsed.data;
    return NextResponse.json(
      data.action === "prepare"
        ? await prepareRydFulfillment(context.admin, context.user.id, data)
        : await finishRydFulfillment(
            context.admin,
            context.user.id,
            data.snapshotId,
            data.action,
          ),
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
