import type { Status } from "./task-types";

/**
 * How a status ends work, which is two questions rather than one.
 *
 * `open` is work still in flight. Both other values close the task: it leaves
 * the active board, stops asking for attention, and archives on the usual
 * delay. Only `delivered` means the work was actually done, so a decline no
 * longer has to choose between sitting in the open counts forever and being
 * reported as something the team shipped.
 */
export const statusOutcomes = ["open", "delivered", "declined"] as const;

export type StatusOutcome = (typeof statusOutcomes)[number];

export const defaultStatusOutcome: StatusOutcome = "open";

/**
 * How long finished work stays on the board before it moves to the archive.
 * The database trigger `set_task_completion_lifecycle` is what actually stamps
 * the dates; this is the mirror the client renders from before the write comes
 * back, and the source of the number every explanation quotes.
 */
export const archiveDelayDays = 14;
export const archiveDelayMs = archiveDelayDays * 24 * 60 * 60 * 1000;

export const statusOutcomeOptions: readonly {
  value: StatusOutcome;
  label: string;
  description: string;
}[] = [
  {
    value: "open",
    label: "Open",
    description: "Work still in progress. Tasks here stay on the board.",
  },
  {
    value: "delivered",
    label: "Delivered",
    description: `Finished work. Tasks here count as completed and archive after ${archiveDelayDays} days.`,
  },
  {
    value: "declined",
    label: "Declined",
    description: `Work that will not be done. Tasks here archive after ${archiveDelayDays} days like finished work, but are never counted as completed.`,
  },
];

export function isStatusOutcome(value: unknown): value is StatusOutcome {
  return statusOutcomes.includes(value as StatusOutcome);
}

export function statusOutcome(value: unknown): StatusOutcome {
  return isStatusOutcome(value) ? value : defaultStatusOutcome;
}

export function statusOutcomeLabel(outcome: StatusOutcome) {
  return (
    statusOutcomeOptions.find((option) => option.value === outcome)?.label ??
    outcome
  );
}

type OutcomeBearing = Pick<Status, "outcome">;

/** Whether a task in this status has stopped needing attention. */
export function closesWork(status: OutcomeBearing) {
  return status.outcome !== "open";
}

/** Whether a task in this status counts as work the team completed. */
export function deliversWork(status: OutcomeBearing) {
  return status.outcome === "delivered";
}

type CompletionTimestamps = {
  completed_at: string | null;
  archived_at: string | null;
};

/**
 * The completion dates a task carries once it sits in the given status. A task
 * that closes keeps the dates it already had, so moving between two closing
 * statuses does not restart the clock, and reopening clears both.
 */
export function taskCompletionLifecycle(
  status: OutcomeBearing | undefined,
  current?: Partial<CompletionTimestamps>,
  now: Date = new Date(),
): CompletionTimestamps {
  if (!status || !closesWork(status))
    return { completed_at: null, archived_at: null };
  const completedAt = current?.completed_at ?? now.toISOString();
  return {
    completed_at: completedAt,
    archived_at:
      current?.archived_at ??
      new Date(new Date(completedAt).getTime() + archiveDelayMs).toISOString(),
  };
}

export function closedStatusIds(statuses: Status[]) {
  return new Set(statuses.filter(closesWork).map((status) => status.id));
}

export function deliveredStatusIds(statuses: Status[]) {
  return new Set(statuses.filter(deliversWork).map((status) => status.id));
}
