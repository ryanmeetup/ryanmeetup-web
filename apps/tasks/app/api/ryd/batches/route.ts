import { NextResponse } from "next/server";
import { emptyObjectSchema } from "@/lib/api-schema/ryd";
import { apiError, logServerFailure } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import {
  isRydEmailConfigured,
  rydContext,
  sendRydBatch,
} from "@/lib/server/ryd";

/** Email the export to fulfillment and mark the verified orders cleared. */
export async function POST(request: Request) {
  const parsed = await readJson(request, emptyObjectSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  if (!isRydEmailConfigured())
    return apiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Email isn't set up on this instance. Download the file and send it by hand.",
    );
  try {
    const result = await sendRydBatch(context.admin, context.user);
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
        error:
          "The batch could not be sent. Nothing was marked cleared, so it's safe to try again.",
        requestId: id,
      },
      { status: 500 },
    );
  }
}
