import { NextResponse } from "next/server";
import { rydDecisionSchema } from "@/lib/api-schema/ryd";
import { databaseFailure, notFound } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { recordRydEvent, rydContext } from "@/lib/server/ryd";

/** Record a decision on one order, or its note. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const parsed = await readJson(request, rydDecisionSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  const { orderId } = await params;

  const current = await context.admin
    .from("ryd_orders")
    .select("status, note, cleared_batch_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (current.error)
    return databaseFailure(request, "ryd.decide", current.error, {
      error: "The decision could not be saved. Try again.",
    });
  if (!current.data) return notFound();
  if (current.data.cleared_batch_id && parsed.data.status)
    return NextResponse.json(
      {
        code: "CONFLICT",
        error:
          "This order was already sent to fulfillment as verified. Tell them directly if that has changed.",
      },
      { status: 409 },
    );

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (parsed.data.status) {
    update.status = parsed.data.status;
    update.decided_at = parsed.data.status === "pending" ? null : now;
    update.decided_by =
      parsed.data.status === "pending" ? null : context.user.id;
  }
  if (parsed.data.note !== undefined) update.note = parsed.data.note;
  const result = await context.admin
    .from("ryd_orders")
    .update(update)
    .eq("order_id", orderId);
  if (result.error)
    return databaseFailure(request, "ryd.decide", result.error, {
      error: "The decision could not be saved. Try again.",
    });

  if (parsed.data.status && parsed.data.status !== current.data.status)
    await recordRydEvent(context.admin, context.user, [orderId], "status", {
      from: current.data.status,
      to: parsed.data.status,
    });
  if (parsed.data.note !== undefined && parsed.data.note !== current.data.note)
    await recordRydEvent(context.admin, context.user, [orderId], "note", {
      note: parsed.data.note,
    });
  return NextResponse.json({ ok: true });
}
