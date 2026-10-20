import { NextResponse } from "next/server";
import { rydLinkSchema } from "@/lib/api-schema/ryd";
import { databaseFailure } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { recordRydEvent, rydContext } from "@/lib/server/ryd";

type Params = { params: Promise<{ orderId: string }> };

/**
 * Pair a form submission with an order. The source records whether a person
 * accepted the app's suggestion or chose the submission themselves.
 */
export async function POST(request: Request, { params }: Params) {
  const parsed = await readJson(request, (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const { source, ...rest } = value as Record<string, unknown>;
    const link = rydLinkSchema(rest);
    return link && (source === "suggested" || source === "manual")
      ? { ...link, source }
      : null;
  });
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  const { orderId } = await params;

  // One submission vouches for one Ryan. The dialog hides claimed ones; this
  // catches a stale tab that still offers it.
  const claimed = await context.admin
    .from("ryd_order_submissions")
    .select("order_id")
    .eq("submission_key", parsed.data.submissionKey)
    .neq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  if (claimed.error)
    return databaseFailure(request, "ryd.link", claimed.error, {
      error: "The submission could not be linked. Try again.",
    });
  if (claimed.data)
    return NextResponse.json(
      {
        code: "CONFLICT",
        error: `That submission is already linked to order ${claimed.data.order_id}. Unlink it there first.`,
      },
      { status: 409 },
    );

  const result = await context.admin.from("ryd_order_submissions").upsert(
    {
      order_id: orderId,
      submission_key: parsed.data.submissionKey,
      source: parsed.data.source,
      linked_by: context.user.id,
    },
    { onConflict: "order_id,submission_key", ignoreDuplicates: true },
  );
  if (result.error)
    return databaseFailure(request, "ryd.link", result.error, {
      error: "The submission could not be linked. Try again.",
    });
  await recordRydEvent(context.admin, context.user, [orderId], "linked", {
    submission_key: parsed.data.submissionKey,
    source: parsed.data.source,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const parsed = await readJson(request, rydLinkSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  const { orderId } = await params;

  const result = await context.admin
    .from("ryd_order_submissions")
    .delete()
    .eq("order_id", orderId)
    .eq("submission_key", parsed.data.submissionKey);
  if (result.error)
    return databaseFailure(request, "ryd.unlink", result.error, {
      error: "The submission could not be unlinked. Try again.",
    });
  await recordRydEvent(context.admin, context.user, [orderId], "unlinked", {
    submission_key: parsed.data.submissionKey,
  });
  return NextResponse.json({ ok: true });
}
