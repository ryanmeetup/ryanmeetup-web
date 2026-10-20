import {
  groupSubmissions,
  type RydSubmission,
  type RydSubmitter,
} from "./matching";
import type { RydOrderStatus } from "./orders";
import type { RydQueue, RydQueueOrder } from "./queue-types";

/** Readable `?status=` values; the enum is an implementation detail. */
export const RYD_STATUS_PARAMS = {
  all: null,
  pending: "pending",
  "needs-info": "needs_info",
  verified: "verified",
  rejected: "rejected",
} as const satisfies Record<string, RydOrderStatus | null>;
export type RydStatusParam = keyof typeof RYD_STATUS_PARAMS;

export function rydStatusParam(value: string): RydStatusParam {
  return value in RYD_STATUS_PARAMS ? (value as RydStatusParam) : "pending";
}

export const RYD_VIEWS = ["queue", "follow-up", "unmatched"] as const;
export type RydView = (typeof RYD_VIEWS)[number];

export function rydView(value: string): RydView {
  return (RYD_VIEWS as readonly string[]).includes(value)
    ? (value as RydView)
    : "queue";
}

export function submissionsByKey(submissions: RydSubmission[]) {
  return new Map(submissions.map((submission) => [submission.key, submission]));
}

/** The submissions on an order: those linked, else the suggested submitter's. */
export function orderSubmissions(
  order: RydQueueOrder,
  submissions: RydSubmission[],
  byKey = submissionsByKey(submissions),
) {
  if (order.linkedKeys.length)
    return {
      linked: true,
      submissions: order.linkedKeys
        .map((key) => byKey.get(key))
        .filter((s): s is RydSubmission => Boolean(s)),
      // A linked submission can vanish if someone deletes the sheet row.
      missing: order.linkedKeys.filter((key) => !byKey.has(key)).length,
    };
  return {
    linked: false,
    submissions: order.suggestion
      ? submissions.filter((s) => s.email === order.suggestion!.email)
      : [],
    missing: 0,
  };
}

/**
 * Orders someone has to chase: asked for more, turned down, or still waiting
 * with nothing on the form that could be theirs.
 */
export function followUpOrders(queue: Pick<RydQueue, "orders">) {
  return queue.orders.filter(
    (order) =>
      order.status === "needs_info" ||
      order.status === "rejected" ||
      (order.status === "pending" &&
        !order.linkedKeys.length &&
        !order.suggestion),
  );
}

/** Form responses no order has claimed or been offered. */
export function unmatchedSubmitters(
  queue: Pick<RydQueue, "orders" | "submissions">,
): RydSubmitter[] {
  const claimed = new Set(queue.orders.flatMap((order) => order.linkedKeys));
  const suggested = new Set(
    queue.orders.map((order) => order.suggestion?.email).filter(Boolean),
  );
  return groupSubmissions(queue.submissions).filter(
    (submitter) =>
      !suggested.has(submitter.email) &&
      !submitter.submissions.some((submission) => claimed.has(submission.key)),
  );
}

export function rydCounts(orders: RydQueueOrder[]) {
  const counts: Record<RydOrderStatus, number> = {
    pending: 0,
    verified: 0,
    needs_info: 0,
    rejected: 0,
  };
  for (const order of orders) counts[order.status] += 1;
  return counts;
}

export function orderSearchText(order: RydQueueOrder) {
  return [
    order.firstName,
    order.lastName,
    order.displayEmail,
    order.orderId,
    order.salesOrder,
    order.note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
