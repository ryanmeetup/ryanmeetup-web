import { NextResponse } from "next/server";
import { rydOrderIdsSchema } from "@/lib/api-schema";
import { databaseFailure } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { recordRydEvent, rydContext } from "@/lib/server/ryd";

/**
 * Record that the reviewer emailed these buyers from their own mail app, so
 * Follow-up shows who has been asked and when. Only open orders still pending
 * or needing more info are marked.
 */
export async function POST(request: Request) {
  const parsed = await readJson(request, rydOrderIdsSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;

  const sentAt = new Date().toISOString();
  const marked = await context.admin
    .from("ryd_orders")
    .update({ last_emailed_at: sentAt })
    .in("order_id", parsed.data.orderIds)
    .in("status", ["pending", "needs_info"])
    .is("cleared_batch_id", null)
    .select("order_id, email");
  if (marked.error)
    return databaseFailure(request, "ryd.reminders", marked.error, {
      error: "Those emails couldn't be recorded. Try again.",
    });
  const rows = marked.data ?? [];
  await Promise.all(
    rows.map((order) =>
      recordRydEvent(context.admin, context.user, [order.order_id], "emailed", {
        to: order.email,
      }),
    ),
  );
  return NextResponse.json({ sentAt, markedCount: rows.length });
}
