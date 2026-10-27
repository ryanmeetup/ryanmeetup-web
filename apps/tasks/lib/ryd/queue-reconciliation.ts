import { savedRydCard } from "./card";
import {
  groupSubmissions,
  suggestMatches,
  type RydSubmission,
} from "./matching";
import type { RydQueue, RydQueueOrder, RydSettings } from "./queue-types";

/** Fields returned by the review transaction, including the database revision. */
export type RydReviewResult = {
  ok: true;
  order: {
    order_id: string;
    status: RydQueueOrder["status"];
    note: string | null;
    decided_at: string | null;
    decided_by: string | null;
    updated_at: string;
    card_first_name?: string | null;
    card_last_name?: string | null;
    card_location?: string | null;
    card_ryan_since?: string | null;
  };
};

export type RydQueueChange =
  | { type: "review"; result: RydReviewResult; linkedKeys: string[] }
  | { type: "links"; orderId: string; keys: string[]; linked: boolean }
  | { type: "dismissal"; submission: RydSubmission; dismissed: boolean }
  | { type: "settings"; settings: RydSettings }
  | { type: "disconnect" };

function submissionClaims(queue: RydQueue) {
  return (
    queue.submissionClaims ??
    Object.fromEntries(
      queue.orders.flatMap((order) =>
        order.linkedKeys.map((key) => [key, order.orderId]),
      ),
    )
  );
}

/** Reuse the same matching rules after a load and after confirmed evidence changes. */
export function withRydQueueMatches(queue: RydQueue): RydQueue {
  const claims = submissionClaims(queue);
  const claimed = new Set(Object.keys(claims));
  const emails = new Set(
    queue.submissions.filter((s) => claimed.has(s.key)).map((s) => s.email),
  );
  const matches = suggestMatches(
    queue.orders.filter((order) => !order.linkedKeys.length),
    groupSubmissions(queue.submissions),
    emails,
  );
  return {
    ...queue,
    submissionClaims: claims,
    orders: queue.orders.map((order) => ({
      ...order,
      suggestion: matches.get(order.orderId) ?? null,
    })),
  };
}

/** Apply only acknowledged writes; a failed reload must not undo them. */
export function reconcileRydQueue(
  queue: RydQueue,
  change: RydQueueChange,
): RydQueue {
  switch (change.type) {
    case "review": {
      const row = change.result.order;
      const card = savedRydCard(row);
      queue = {
        ...queue,
        orders: queue.orders.map((order) =>
          order.orderId === row.order_id
            ? {
                ...order,
                status: row.status,
                note: row.note,
                decidedAt: row.decided_at,
                decidedBy: row.decided_by,
                updatedAt: row.updated_at,
                ...(card ? { card, cardSaved: true } : {}),
              }
            : order,
        ),
      };
      return reconcileRydQueue(queue, {
        type: "links",
        orderId: row.order_id,
        keys: change.linkedKeys,
        linked: true,
      });
    }
    case "links": {
      const keys = new Set(change.keys);
      const claims = { ...submissionClaims(queue) };
      for (const key of keys) {
        if (change.linked) claims[key] = change.orderId;
        else if (claims[key] === change.orderId) delete claims[key];
      }
      queue = {
        ...queue,
        submissionClaims: claims,
        orders: queue.orders.map((order) =>
          order.orderId === change.orderId
            ? {
                ...order,
                linkedKeys: change.linked
                  ? [...new Set([...order.linkedKeys, ...keys])]
                  : order.linkedKeys.filter((key) => !keys.has(key)),
              }
            : order,
        ),
      };
      break;
    }
    case "dismissal": {
      const { submission, dismissed } = change;
      const active = queue.submissions.filter((s) => s.key !== submission.key);
      const removed = queue.dismissed.filter((s) => s.key !== submission.key);
      queue = {
        ...queue,
        submissions: dismissed ? active : [...active, submission],
        dismissed: dismissed ? [...removed, submission] : removed,
      };
      break;
    }
    case "settings":
      if (queue.settings.formId === change.settings.formId)
        return { ...queue, settings: change.settings };
      queue = {
        ...queue,
        settings: change.settings,
        submissionClaims: {},
        submissions: [],
        dismissed: [],
        sheet:
          queue.sheet.status === "disconnected"
            ? queue.sheet
            : {
                status: change.settings.formId ? "ok" : "unconfigured",
                accountEmail: queue.sheet.accountEmail,
              },
      };
      break;
    case "disconnect":
      queue = {
        ...queue,
        submissions: [],
        dismissed: [],
        sheet: { status: "disconnected" },
      };
      break;
  }
  return withRydQueueMatches(queue);
}
