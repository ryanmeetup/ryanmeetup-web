import { NextResponse } from "next/server";
import { rydLinkSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import {
  changeRydSubmission,
  rydMutationFailure,
} from "@/lib/server/ryd-mutations";

async function change(request: Request, action: "dismiss" | "restore") {
  const parsed = await readJson(request, rydLinkSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    return NextResponse.json(
      await changeRydSubmission(
        context.admin,
        context.user.id,
        action,
        parsed.data.submissionKey,
      ),
    );
  } catch (error) {
    return rydMutationFailure(
      request,
      `ryd.${action}`,
      error,
      "The response could not be updated. Try again.",
    );
  }
}

export const POST = (request: Request) => change(request, "dismiss");
export const DELETE = (request: Request) => change(request, "restore");
