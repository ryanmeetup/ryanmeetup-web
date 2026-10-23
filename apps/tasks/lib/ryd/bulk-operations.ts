import { rydMailtoHref, rydUnmatchedEmail } from "./emails";
import type { RydQueue, RydQueueOrder } from "./queue-types";
import { isRydContactEmail, normalizeEmail } from "./normalize";
import { rydProductionStage, type RydProductionStage } from "./queue-view";

export const RYD_BULK_LIMIT = 100;
export const RYD_BULK_BODY_BYTES = 14_000;
export const RYD_MAILTO_LIMIT = 1900;
const OPERATION_PLACEHOLDER = "00000000-0000-4000-8000-000000000000";
export type RydProductionAction = "sent" | "done" | "back";
export type RydProductionMove = {
  orderId: string;
  from: RydProductionStage;
  to: RydProductionStage;
};
export type RydProductionResult = {
  movedCount: number;
  orders: Pick<
    RydQueueOrder,
    "orderId" | "productionSentAt" | "doneAt" | "updatedAt"
  >[];
};
export type RydContactResult = {
  markedCount: number;
  contactedAt: string;
  contacts: RydQueue["contacts"];
};
export const rydBodyBytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

/** Preserve order and bound the actual encoded request, including its envelope. */
function boundedGroups<T>(
  items: T[],
  body: (group: T[]) => unknown,
  fits?: (group: T[]) => boolean,
) {
  const groups: T[][] = [];
  let group: T[] = [];
  const allowed = (rows: T[]) =>
    rows.length <= RYD_BULK_LIMIT &&
    rydBodyBytes(body(rows)) <= RYD_BULK_BODY_BYTES &&
    (fits?.(rows) ?? true);
  for (const item of items) {
    if (group.length && !allowed([...group, item])) {
      groups.push(group);
      group = [];
    }
    // Callers validate each item before constructing an operation. A single
    // invalid item must not silently disappear from the selected operation.
    if (!allowed([item]))
      throw new Error("An item is too large for this operation.");
    group.push(item);
  }
  if (group.length) groups.push(group);
  return groups;
}

export function rydProductionGroups(
  orders: RydQueueOrder[],
  action: RydProductionAction,
) {
  const moves: RydProductionMove[] = [];
  const seen = new Set<string>();
  for (const order of orders) {
    if (seen.has(order.orderId) || order.status !== "verified") continue;
    seen.add(order.orderId);
    const from = rydProductionStage(order);
    // Starting production records fulfillment's acknowledgment, after the
    // email has been recorded. Completion waits for production to start.
    if (action === "sent" && !order.sentToFulfillment) continue;
    if (action === "done" && from !== "in-production") continue;
    const to =
      action === "done"
        ? "done"
        : action === "sent"
          ? from === "not-started"
            ? "in-production"
            : from
          : from === "done"
            ? "in-production"
            : "not-started";
    if (to !== from) moves.push({ orderId: order.orderId, from, to });
  }
  return boundedGroups(moves, (group) => ({
    operationId: OPERATION_PLACEHOLDER,
    moves: group,
  }));
}

/** Each independent draft is also one bounded, idempotent confirmation. */
export function rydContactGroups(addresses: string[], draft = true) {
  const emails = [
    ...new Set(addresses.filter(isRydContactEmail).map(normalizeEmail)),
  ];
  return boundedGroups(
    emails,
    (group) => ({ operationId: OPERATION_PLACEHOLDER, emails: group }),
    draft
      ? (group) =>
          group.length === 1 ||
          rydMailtoHref({ bcc: group, ...rydUnmatchedEmail() }).length <=
            RYD_MAILTO_LIMIT
      : undefined,
  );
}
