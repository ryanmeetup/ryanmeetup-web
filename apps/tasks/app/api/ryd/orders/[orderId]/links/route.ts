import { NextResponse } from "next/server";
import { rydLinkSchema, rydLinkCreateSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import {
  changeRydSubmission,
  linkRydSubmissions,
  rydMutationFailure,
} from "@/lib/server/ryd-mutations";

type Params = { params: Promise<{ orderId: string }> };

async function change(
  request: Request,
  { params }: Params,
  data:
    | { submissionKey: string }
    | { submissionKeys: string[]; source: "manual" | "suggested" },
) {
  const action = "submissionKeys" in data ? "link" : "unlink";
  const context = await rydContext();
  if ("response" in context) return context.response;
  const { orderId } = await params;
  try {
    return NextResponse.json(
      "submissionKeys" in data
        ? await linkRydSubmissions(
            context.admin,
            context.user.id,
            orderId,
            data.submissionKeys,
            data.source,
          )
        : await changeRydSubmission(
            context.admin,
            context.user.id,
            action,
            data.submissionKey,
            orderId,
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
    : change(request, params, parsed.data);
}

export async function DELETE(request: Request, params: Params) {
  const parsed = await readJson(request, rydLinkSchema);
  return "response" in parsed
    ? parsed.response
    : change(request, params, parsed.data);
}
