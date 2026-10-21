import { NextResponse } from "next/server";
import { rydOrderIdsSchema } from "@/lib/api-schema";
import { apiError, logServerFailure } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { markRydBatchSent, rydContext } from "@/lib/server/ryd";

/**
 * Record that the reviewer emailed fulfillment the file, and clear the
 * verified orders it listed.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydOrderIdsSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    const result = await markRydBatchSent(
      context.admin,
      context.user,
      parsed.data.orderIds,
    );
    if (!result.ok) return apiError(400, "INVALID_REQUEST", result.error);
    return NextResponse.json(result);
  } catch (error) {
    const id = logServerFailure(
      request,
      "ryd.batch",
      error as { code?: string; message?: string },
    );
    return NextResponse.json(
      {
        code: "OPERATION_FAILED",
        error: "The batch could not be marked sent. Try again.",
        requestId: id,
      },
      { status: 500 },
    );
  }
}
