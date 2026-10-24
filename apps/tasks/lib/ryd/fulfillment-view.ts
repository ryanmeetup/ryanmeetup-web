import type { RydQueueOrder } from "./queue-types";

/**
 * Production runs in fulfillment's own system, so RY-D tracks only the
 * handoff. `productionSentAt` is when an order was sent to fulfillment.
 */
export const RYD_FULFILLMENT_STAGES = [
  "ready-to-send",
  "sent-to-fulfillment",
  "done",
] as const;
export type RydFulfillmentStage = (typeof RYD_FULFILLMENT_STAGES)[number];

export const RYD_FULFILLMENT_LABELS: Record<RydFulfillmentStage, string> = {
  "ready-to-send": "Ready to send",
  "sent-to-fulfillment": "Sent to fulfillment",
  done: "Done",
};

export function rydFulfillmentStage(
  order: Pick<
    RydQueueOrder,
    "sentToFulfillment" | "productionSentAt" | "doneAt"
  >,
): RydFulfillmentStage {
  if (order.doneAt) return "done";
  return order.sentToFulfillment || order.productionSentAt
    ? "sent-to-fulfillment"
    : "ready-to-send";
}

/** Accept the previous bookmark while generating descriptive stage values. */
export function rydFulfillmentParam(value: string): RydFulfillmentStage | null {
  if (!value || value === "not-started") return "ready-to-send";
  if (value === "in-production") return "sent-to-fulfillment";
  return (RYD_FULFILLMENT_STAGES as readonly string[]).includes(value)
    ? (value as RydFulfillmentStage)
    : null;
}

export function rydFulfillmentCounts(orders: RydQueueOrder[]) {
  const counts: Record<RydFulfillmentStage, number> = {
    "ready-to-send": 0,
    "sent-to-fulfillment": 0,
    done: 0,
  };
  for (const order of orders)
    if (order.status === "verified") counts[rydFulfillmentStage(order)] += 1;
  return counts;
}

/** Orders eligible for an on-demand email and CSV. */
export function readyForRydFulfillment(orders: RydQueueOrder[]) {
  return orders.filter(
    (order) =>
      order.status === "verified" &&
      rydFulfillmentStage(order) === "ready-to-send",
  );
}
