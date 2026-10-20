import { NextResponse } from "next/server";
import { emptyObjectSchema } from "@/lib/api-schema/ryd";
import {
  apiError,
  databaseFailure,
  logServerFailure,
  notFound,
} from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import {
  emailRydCustomer,
  isRydEmailConfigured,
  recordRydEvent,
  rydContext,
} from "@/lib/server/ryd";

/** Ask the buyer for their ry-dentification, or for a little more of it. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const parsed = await readJson(request, emptyObjectSchema);
  if ("response" in parsed) return parsed.response;
  const context = await rydContext();
  if ("response" in context) return context.response;
  if (!isRydEmailConfigured())
    return apiError(
      503,
      "SERVICE_UNAVAILABLE",
      "Email isn't set up on this instance.",
    );
  const { orderId } = await params;

  const [order, links] = await Promise.all([
    context.admin
      .from("ryd_orders")
      .select("order_id, first_name, email")
      .eq("order_id", orderId)
      .maybeSingle(),
    context.admin
      .from("ryd_order_submissions")
      .select("submission_key", { count: "exact", head: true })
      .eq("order_id", orderId),
  ]);
  const failure = order.error ?? links.error;
  if (failure)
    return databaseFailure(request, "ryd.email", failure, {
      error: "The email could not be sent. Try again.",
    });
  if (!order.data) return notFound();
  if (!order.data.email)
    return apiError(400, "INVALID_REQUEST", "This order has no email address.");

  try {
    await emailRydCustomer(order.data, (links.count ?? 0) > 0);
  } catch (error) {
    logServerFailure(request, "ryd.email", {
      message: error instanceof Error ? error.message : String(error),
    });
    return apiError(
      500,
      "OPERATION_FAILED",
      "The email could not be sent. Try again.",
    );
  }
  const sentAt = new Date().toISOString();
  await context.admin
    .from("ryd_orders")
    .update({ last_emailed_at: sentAt })
    .eq("order_id", orderId);
  await recordRydEvent(context.admin, context.user, [orderId], "emailed", {
    to: order.data.email,
  });
  return NextResponse.json({ sentAt });
}
