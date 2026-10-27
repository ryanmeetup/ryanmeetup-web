import { rydCancelledBuyerEmail, type RydDraft } from "./emails";
import { isRydContactEmail, normalizeEmail } from "./normalize";
import type { RydQueueOrder } from "./queue-types";
import { RYD_REMINDER_GROUP_LIMIT, rydReminderHasEvidence } from "./reminders";

export type RydCancellationGroup = {
  key: string;
  label: string;
  addresses: string[];
  draft: RydDraft;
};

/**
 * Bcc drafts telling buyers their orders were cancelled, split by whether
 * they ever sent anything so each email gives the right reason. A buyer with
 * several orders gets one email; one without a usable address is counted so
 * the reviewer knows to reach them another way.
 */
export function rydCancellationGroups(orders: RydQueueOrder[]) {
  const people = new Map<string, RydQueueOrder[]>();
  let unreachable = 0;
  for (const order of orders) {
    if (!isRydContactEmail(order.displayEmail)) {
      unreachable += 1;
      continue;
    }
    const email = normalizeEmail(order.displayEmail);
    people.set(email, [...(people.get(email) ?? []), order]);
  }
  const groups: RydCancellationGroup[] = [];
  for (const hasSubmission of [false, true]) {
    const matching = [...people.values()].filter(
      (rows) => rows.some(rydReminderHasEvidence) === hasSubmission,
    );
    for (let start = 0; start < matching.length;) {
      const chunk = matching.slice(start, start + RYD_REMINDER_GROUP_LIMIT);
      start += chunk.length;
      groups.push({
        key: `${hasSubmission ? "reviewed" : "nothing-sent"}:${groups.length}`,
        label: hasSubmission
          ? "Sent something that didn't verify"
          : "Nothing sent",
        addresses: chunk.map((rows) => rows[0].displayEmail.trim()),
        draft: rydCancelledBuyerEmail({
          hasSubmission,
          firstName: chunk.length === 1 ? chunk[0][0].firstName : "",
        }),
      });
    }
  }
  return { groups, unreachable };
}
