import {
  groupSubmissions,
  type RydSubmission,
  type RydSubmitter,
} from "./matching";
import { ryanPosition, type RyanPosition } from "./normalize";
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
 * Where Ryan falls in the name the order's form submission gives, linked or
 * suggested, or in the buyer's own name when the form gives none. Null only
 * when there's no name either way.
 */
export function orderRyanPosition(
  order: RydQueueOrder,
  submissions: RydSubmission[],
  byKey = submissionsByKey(submissions),
): RyanPosition | null {
  const name =
    orderSubmissions(order, submissions, byKey).submissions.find(
      (submission) => submission.legalName,
    )?.legalName ?? `${order.firstName} ${order.lastName}`;
  return ryanPosition(name);
}

export function orderRyanPositions(
  orders: RydQueueOrder[],
  submissions: RydSubmission[],
) {
  const byKey = submissionsByKey(submissions);
  return new Map(
    orders.map((order) => [
      order.orderId,
      orderRyanPosition(order, submissions, byKey),
    ]),
  );
}

/** Submissions already linked to some other order, so not offered here. */
export function claimedElsewhere(
  orders: Pick<RydQueueOrder, "orderId" | "linkedKeys">[],
  orderId: string,
) {
  return new Set(
    orders
      .filter((order) => order.orderId !== orderId)
      .flatMap((order) => order.linkedKeys),
  );
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

/**
 * A buyer emailed this recently isn't emailed again by Email everyone. Under
 * a day, so a reminder sent each morning is never skipped.
 */
export const RYD_REMIND_AGAIN_MS = 20 * 60 * 60 * 1000;

/** The follow-up orders Email everyone would send to right now. */
export function remindableOrders(orders: RydQueueOrder[], now = Date.now()) {
  return orders.filter(
    (order) =>
      order.status !== "rejected" &&
      order.email &&
      !(
        order.lastEmailedAt &&
        Date.parse(order.lastEmailedAt) > now - RYD_REMIND_AGAIN_MS
      ),
  );
}

/**
 * The unmatched submitters Email everyone would send to right now, leaving out
 * anyone contacted inside the same window as a buyer reminder.
 */
export function contactableSubmitters(
  submitters: RydSubmitter[],
  contacts: RydQueue["contacts"],
  now = Date.now(),
) {
  return submitters.filter((submitter) => {
    const contact = contacts[submitter.email];
    return !(
      contact && Date.parse(contact.lastContactedAt) > now - RYD_REMIND_AGAIN_MS
    );
  });
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

export const RYD_SORT_KEYS = [
  "name",
  "ryan",
  "middle-name",
  "status",
  "form",
  "ordered",
] as const;
export type RydSortKey = (typeof RYD_SORT_KEYS)[number];
export type RydSort = { key: RydSortKey; descending: boolean } | null;

/** `?sort=name` or `?sort=name-desc`; anything else keeps the queue's order. */
export function rydSortParam(value: string): RydSort {
  const descending = value.endsWith("-desc");
  const key = descending ? value.slice(0, -"-desc".length) : value;
  return (RYD_SORT_KEYS as readonly string[]).includes(key)
    ? { key: key as RydSortKey, descending }
    : null;
}

export function rydSortValue(sort: RydSort) {
  return sort ? `${sort.key}${sort.descending ? "-desc" : ""}` : "";
}

/** The workflow's order, not the alphabet's. */
const STATUS_RANK: Record<RydOrderStatus, number> = {
  pending: 0,
  needs_info: 1,
  verified: 2,
  rejected: 3,
};

/** Surest pairing first: linked, then by confidence, then nothing found. */
function formRank(order: RydQueueOrder) {
  if (order.linkedKeys.length) return 0;
  if (!order.suggestion) return 4;
  return { strong: 1, possible: 2, weak: 3 }[order.suggestion.confidence];
}

function orderedTime(order: RydQueueOrder) {
  const time = Date.parse(order.orderedAt);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/**
 * The Ryan sorts group by where Ryan falls in the form's name, or the buyer's
 * name when the form gives none (see `orderRyanPosition`). `ryan` runs
 * first-name Ryans to non-Ryans; `middle-name` pulls middle-name Ryans to the
 * top for checking.
 */
const RYAN_RANK: Record<
  "ryan" | "middle-name",
  Record<RyanPosition, number>
> = {
  ryan: { first: 0, middle: 1, last: 2, absent: 3 },
  "middle-name": { middle: 0, first: 1, last: 2, absent: 3 },
};

const byName = (a: RydQueueOrder, b: RydQueueOrder) =>
  a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" }) ||
  a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" }) ||
  a.orderId.localeCompare(b.orderId, undefined, { numeric: true });

const COMPARE: Record<
  Exclude<RydSortKey, keyof typeof RYAN_RANK>,
  (a: RydQueueOrder, b: RydQueueOrder) => number
> = {
  name: byName,
  status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
  form: (a, b) => formRank(a) - formRank(b),
  ordered: (a, b) =>
    orderedTime(a) - orderedTime(b) ||
    a.orderId.localeCompare(b.orderId, undefined, { numeric: true }),
};

/**
 * Orders sorted by one column. Ties fall back to name, ascending whichever
 * way the column runs, so a group of Pending orders still reads A to Z.
 * The Ryan sorts read `positions`; an order with no name to read can't be
 * placed, so it goes last in either direction.
 */
export function sortRydOrders(
  orders: RydQueueOrder[],
  sort: RydSort,
  positions: ReadonlyMap<string, RyanPosition | null> = new Map(),
) {
  if (!sort) return orders;
  const direction = sort.descending ? -1 : 1;
  const { key } = sort;
  if (key === "ryan" || key === "middle-name") {
    const rank = (order: RydQueueOrder) => {
      const position = positions.get(order.orderId);
      return position ? RYAN_RANK[key][position] : null;
    };
    return [...orders].sort((a, b) => {
      const [left, right] = [rank(a), rank(b)];
      if (left === null || right === null)
        return Number(left === null) - Number(right === null) || byName(a, b);
      return direction * (left - right) || byName(a, b);
    });
  }
  return [...orders].sort(
    (a, b) => direction * COMPARE[key](a, b) || byName(a, b),
  );
}

/**
 * Orders a stray submission could still go to: those with nothing linked yet,
 * in workflow order and then by name, so the menu groups by status.
 */
export function linkableOrders(orders: RydQueueOrder[]) {
  return sortRydOrders(
    orders.filter((order) => !order.linkedKeys.length),
    { key: "status", descending: false },
  );
}
