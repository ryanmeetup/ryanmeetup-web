import { NextResponse } from "next/server";
import { rydReminderSchema } from "@/lib/api-schema";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { rydMutationFailure } from "@/lib/server/ryd-mutations";

/** Record one explicitly confirmed draft, with its audit and retry receipt. */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydReminderSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  try {
    const result = await context.admin.rpc("ryd_record_reminders", {
      requested_actor: context.user.id,
      requested_operation: parsed.data.operationId,
      requested_targets: parsed.data.targets,
    });
    if (result.error) throw result.error;
    return NextResponse.json(result.data);
  } catch (error) {
    return rydMutationFailure(
      request,
      "ryd.reminders",
      error,
      "Those emails couldn't be recorded. Try again.",
    );
  }
}
