import { rydCardComplete } from "./card";
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

/**
 * Where each verified, ready-to-send order stands against the next card
 * file. Only `printable` goes in; the rest say why the file is short.
 */
export function rydCardFileStatus(orders: RydQueueOrder[]) {
  const status = {
    printable: [] as RydQueueOrder[],
    /** Complete, but no one has saved the card in its review. */
    notApproved: 0,
    /** Missing a line the card prints, or a year out of range. */
    unfinished: 0,
  };
  for (const order of readyForRydFulfillment(orders)) {
    if (!rydCardComplete(order.card)) status.unfinished += 1;
    else if (!order.cardSaved) status.notApproved += 1;
    else status.printable.push(order);
  }
  return status;
}
