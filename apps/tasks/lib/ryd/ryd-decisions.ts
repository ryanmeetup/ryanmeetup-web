"use client";

import { mutate } from "@/lib/mutation-client";
import type { RydCard } from "./card";
import type { RydSubmission } from "./matching";
import type { RydOrderStatus } from "./orders";
import type { RydQueueOrder } from "./queue-types";
import { orderSubmissions } from "./queue-view";
import type { RydQueueChange, RydReviewResult } from "./queue-reconciliation";

/** Fulfillment has it, or it's being made: its decision can't change. */
export function rydDecisionLocked(order: RydQueueOrder) {
  return order.sentToFulfillment || Boolean(order.productionSentAt);
}

/**
 * Record a decision on one order, with its note when one is given. Verifying
 * from a suggestion accepts it: the pairing is what lets the send step tick
 * the right rows in the response sheet. Verifying also approves the card as
 * shown, which is what fulfillment prints; pass `card` for edited lines.
 */
export async function decideRydOrder(
  order: RydQueueOrder,
  submissions: RydSubmission[],
  status: RydOrderStatus,
  note?: string,
  card: RydCard = order.card,
): Promise<RydQueueChange> {
  const base = `/api/ryd/orders/${encodeURIComponent(order.orderId)}`;
  const shown = orderSubmissions(order, submissions);
  const linkedKeys =
    status === "verified" && !shown.linked
      ? shown.submissions.map((submission) => submission.key)
      : [];
  const result = await mutate<RydReviewResult>(base, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      ...(note !== undefined ? { note } : {}),
      expectedStatus: order.status,
      expectedUpdatedAt: order.updatedAt,
      ...(status === "verified" ? { card } : {}),
      ...(status === "verified" && !shown.linked
        ? {
            submissionKeys: linkedKeys,
          }
        : {}),
    }),
  });
  return { type: "review", result, linkedKeys };
}

export async function saveRydNote(
  order: RydQueueOrder,
  note: string,
): Promise<RydQueueChange> {
  const result = await mutate<RydReviewResult>(
    `/api/ryd/orders/${encodeURIComponent(order.orderId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ note, expectedUpdatedAt: order.updatedAt }),
    },
  );
  return { type: "review", result, linkedKeys: [] };
}

/** Save a card without deciding; on a verified order this re-approves it. */
export async function saveRydCard(
  order: RydQueueOrder,
  card: RydCard,
): Promise<RydQueueChange> {
  const result = await mutate<RydReviewResult>(
    `/api/ryd/orders/${encodeURIComponent(order.orderId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ card, expectedUpdatedAt: order.updatedAt }),
    },
  );
  return { type: "review", result, linkedKeys: [] };
}

export async function changeRydLinks(
  orderId: string,
  keys: string[],
  linked: boolean,
  source: "suggested" | "manual" = "manual",
): Promise<RydQueueChange> {
  await mutate(`/api/ryd/orders/${encodeURIComponent(orderId)}/links`, {
    method: linked ? "POST" : "DELETE",
    body: JSON.stringify(
      linked ? { submissionKeys: keys, source } : { submissionKey: keys[0] },
    ),
  });
  return { type: "links", orderId, keys, linked };
}
