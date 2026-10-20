import { NextResponse } from "next/server";
import { rydProductionSchema } from "@/lib/api-schema/ryd";
import { logServerFailure } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { rydContext, setRydProductionStage } from "@/lib/server/ryd";

/**
 * Move verified orders between not sent, in production, and done. Orders
 * that aren't verified are left alone.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydProductionSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    return NextResponse.json(
      await setRydProductionStage(
        context.admin,
        context.user,
        parsed.data.orderIds,
        parsed.data.stage,
      ),
    );
  } catch (error) {
    const id = logServerFailure(
      request,
      "ryd.production",
      error as { code?: string; message?: string },
    );
    return NextResponse.json(
      {
        code: "OPERATION_FAILED",
        error: "Those orders couldn't be moved. Try again.",
        requestId: id,
      },
      { status: 500 },
    );
  }
}
