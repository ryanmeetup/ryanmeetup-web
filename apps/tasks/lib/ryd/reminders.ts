import { rydBuyerEmail, type RydDraft } from "./emails";
import { isRydContactEmail, normalizeEmail } from "./normalize";
import type { RydQueueOrder } from "./queue-types";
import { canEmailRydOrder } from "./queue-view";

export const RYD_REMINDER_GROUP_LIMIT = 100;
export type RydReminderTarget = { orderId: string; email: string };
export type RydReminderResult = {
  markedCount: number;
  skippedCount: number;
  sentAt: string;
};
export type RydReminderGroup = {
  key: string;
  label: string;
  targets: RydReminderTarget[];
  addresses: string[];
  draft: RydDraft;
};

export const rydReminderHasEvidence = (
  order: Pick<RydQueueOrder, "linkedKeys" | "suggestion">,
) => Boolean(order.linkedKeys.length || order.suggestion);

/** Pin recipients and evidence wording once, independently of later reloads. */
export function rydReminderGroups(orders: RydQueueOrder[]): RydReminderGroup[] {
  const people = new Map<string, RydQueueOrder[]>();
  const seen = new Set<string>();
  for (const order of orders) {
    if (
      seen.has(order.orderId) ||
      !canEmailRydOrder(order) ||
      !isRydContactEmail(order.displayEmail) ||
      normalizeEmail(order.displayEmail) !== normalizeEmail(order.email)
    )
      continue;
    seen.add(order.orderId);
    const email = normalizeEmail(order.email);
    const person = people.get(email) ?? [];
    person.push(order);
    people.set(email, person);
  }
  const groups: RydReminderGroup[] = [];
  for (const hasSubmission of [false, true]) {
    const matching = [...people.values()]
      .filter((rows) => rows.some(rydReminderHasEvidence) === hasSubmission)
      .flat();
    const chunks: RydQueueOrder[][] = [];
    let chunk: RydQueueOrder[] = [];
    for (const order of matching) {
      const candidate = [...chunk, order];
      const bytes = new TextEncoder().encode(
        JSON.stringify({
          operationId: "00000000-0000-4000-8000-000000000000",
          targets: candidate.map((row) => ({
            orderId: row.orderId,
            email: normalizeEmail(row.email),
          })),
        }),
      ).byteLength;
      if (
        chunk.length &&
        (candidate.length > RYD_REMINDER_GROUP_LIMIT || bytes > 14000)
      ) {
        chunks.push(chunk);
        chunk = [];
      }
      chunk.push(order);
    }
    if (chunk.length) chunks.push(chunk);
    for (const [index, rows] of chunks.entries()) {
      const addresses = [
        ...new Map(
          rows.map((order) => [
            normalizeEmail(order.email),
            order.displayEmail,
          ]),
        ).values(),
      ];
      groups.push({
        key: `${hasSubmission ? "more" : "verify"}:${index}`,
        label: hasSubmission
          ? "Sent something, needs more"
          : "Nothing sent yet",
        targets: rows.map((order) => ({
          orderId: order.orderId,
          email: normalizeEmail(order.email),
        })),
        addresses,
        draft: rydBuyerEmail({
          hasSubmission,
          firstName: addresses.length === 1 ? rows[0].firstName : "",
        }),
      });
    }
  }
  return groups;
}
