import type { RydQueueOrder } from "./queue-types";

/** The email handoff and the factory's acknowledgment are separate steps. */
export const RYD_FULFILLMENT_STAGES = [
  "ready-to-send",
  "sent-to-fulfillment",
  "in-production",
  "done",
] as const;
export type RydFulfillmentStage = (typeof RYD_FULFILLMENT_STAGES)[number];

export const RYD_FULFILLMENT_LABELS: Record<RydFulfillmentStage, string> = {
  "ready-to-send": "Ready to send",
  "sent-to-fulfillment": "Sent to fulfillment",
  "in-production": "In production",
  done: "Done",
};

export function rydFulfillmentStage(
  order: Pick<
    RydQueueOrder,
    "sentToFulfillment" | "productionSentAt" | "doneAt"
  >,
): RydFulfillmentStage {
  if (order.doneAt) return "done";
  if (order.productionSentAt) return "in-production";
  return order.sentToFulfillment ? "sent-to-fulfillment" : "ready-to-send";
}

/** Accept the previous bookmark while generating descriptive stage values. */
export function rydFulfillmentParam(value: string): RydFulfillmentStage | null {
  if (!value || value === "not-started") return "ready-to-send";
  return (RYD_FULFILLMENT_STAGES as readonly string[]).includes(value)
    ? (value as RydFulfillmentStage)
    : null;
}

export function rydFulfillmentCounts(orders: RydQueueOrder[]) {
  const counts: Record<RydFulfillmentStage, number> = {
    "ready-to-send": 0,
    "sent-to-fulfillment": 0,
    "in-production": 0,
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
