import { NextResponse } from "next/server";
import { rydEmailsSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { recordRydContacts } from "@/lib/server/ryd-bulk";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";

/**
 * Record that the reviewer emailed these unmatched submitters from their own
 * mail app. Reusing an operation ID cannot record the attempt twice.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydEmailsSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;

  try {
    return NextResponse.json(
      await recordRydContacts(
        context.admin,
        context.user.id,
        parsed.data.operationId,
        parsed.data.emails,
      ),
    );
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.contacts",
      error,
      "Those contacts couldn't be recorded. Retry the same group.",
    );
  }
}
