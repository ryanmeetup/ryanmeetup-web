import { NextResponse } from "next/server";
import { rydLinkSchema } from "@/lib/api-schema/ryd";
import { apiError, databaseFailure } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { rydContext } from "@/lib/server/ryd";
import { isMissingRelation } from "@/lib/server/supabase-errors";

const notInstalled = () =>
  apiError(
    503,
    "SERVICE_UNAVAILABLE",
    "Removing responses needs a pending database update. Apply it, then try again.",
  );

/**
 * Set a form response aside, usually a buyer's duplicate. Google keeps the
 * response; RY-D stops offering it. A response already vouching for an order
 * has to be unlinked first, so removing one never quietly empties an order.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydLinkSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  const { submissionKey } = parsed.data;

  const linked = await context.admin
    .from("ryd_order_submissions")
    .select("order_id")
    .eq("submission_key", submissionKey)
    .limit(1)
    .maybeSingle();
  if (linked.error)
    return databaseFailure(request, "ryd.dismiss", linked.error, {
      error: "The response could not be removed. Try again.",
    });
  if (linked.data)
    return NextResponse.json(
      {
        code: "CONFLICT",
        error: `That response is linked to order ${linked.data.order_id}. Unlink it there first.`,
      },
      { status: 409 },
    );

  const result = await context.admin
    .from("ryd_dismissed_submissions")
    .upsert(
      { submission_key: submissionKey, dismissed_by: context.user.id },
      { onConflict: "submission_key", ignoreDuplicates: true },
    );
  if (result.error) {
    if (isMissingRelation(result.error.code)) return notInstalled();
    return databaseFailure(request, "ryd.dismiss", result.error, {
      error: "The response could not be removed. Try again.",
    });
  }
  return NextResponse.json({ ok: true });
}

/** Put a set-aside response back in the queue. */
export async function DELETE(request: Request) {
  const parsed = await readJson(request, rydLinkSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;

  const result = await context.admin
    .from("ryd_dismissed_submissions")
    .delete()
    .eq("submission_key", parsed.data.submissionKey);
  if (result.error) {
    if (isMissingRelation(result.error.code)) return notInstalled();
    return databaseFailure(request, "ryd.restore", result.error, {
      error: "The response could not be restored. Try again.",
    });
  }
  return NextResponse.json({ ok: true });
}
