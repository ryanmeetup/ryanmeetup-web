import { NextResponse } from "next/server";
import { rydLinkSchema, rydLinkCreateSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import {
  changeRydSubmission,
  rydMutationFailure,
} from "@/lib/server/ryd-mutations";

type Params = { params: Promise<{ orderId: string }> };

async function change(
  request: Request,
  { params }: Params,
  action: "link" | "unlink",
  data: { submissionKey: string; source?: "manual" | "suggested" },
) {
  const context = await rydContext();
  if ("response" in context) return context.response;
  const { orderId } = await params;
  try {
    return NextResponse.json(
      await changeRydSubmission(
        context.admin,
        context.user.id,
        action,
        data.submissionKey,
        orderId,
        data.source,
      ),
    );
  } catch (error) {
    return rydMutationFailure(
      request,
      `ryd.${action}`,
      error,
      "The submission could not be updated. Try again.",
    );
  }
}

export async function POST(request: Request, params: Params) {
  const parsed = await readJson(request, rydLinkCreateSchema);
  return "response" in parsed
    ? parsed.response
    : change(request, params, "link", parsed.data);
}

export async function DELETE(request: Request, params: Params) {
  const parsed = await readJson(request, rydLinkSchema);
  return "response" in parsed
    ? parsed.response
    : change(request, params, "unlink", parsed.data);
}
