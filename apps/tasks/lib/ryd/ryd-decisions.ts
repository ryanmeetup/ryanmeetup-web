"use client";

import { mutate } from "@/lib/mutation-client";
import type { RydSubmission } from "./matching";
import type { RydOrderStatus } from "./orders";
import type { RydQueueOrder } from "./queue-types";
import { orderSubmissions } from "./queue-view";

/** Fulfillment has it, or it's being made: its decision can't change. */
export function rydDecisionLocked(order: RydQueueOrder) {
  return order.sentToFulfillment || Boolean(order.productionSentAt);
}

/**
 * Record a decision on one order, with its note when one is given. Verifying
 * from a suggestion accepts it: the pairing is what lets the send step tick
 * the right rows in the response sheet.
 */
export async function decideRydOrder(
  order: RydQueueOrder,
  submissions: RydSubmission[],
  status: RydOrderStatus,
  note?: string,
) {
  const base = `/api/ryd/orders/${encodeURIComponent(order.orderId)}`;
  const shown = orderSubmissions(order, submissions);
  await mutate(base, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      ...(note !== undefined ? { note } : {}),
      expectedStatus: order.status,
      expectedUpdatedAt: order.updatedAt,
      ...(status === "verified" && !shown.linked
        ? {
            submissionKeys: shown.submissions.map(
              (submission) => submission.key,
            ),
          }
        : {}),
    }),
  });
}
