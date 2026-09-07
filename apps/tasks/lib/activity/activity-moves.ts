import type { Status } from "@/lib/tasks/task-types";
import { TASK_MOVE_ACTION } from "./activity-events";
import type { TaskActivity } from "./activity-types";

/**
 * The status-move half of the Activity filters: which column a task landed in,
 * which one it left, or both at once.
 *
 * The Event filter answers "was this a move?" and stops there, so the question
 * behind it -- "what got marked done this week?" -- had no answer short of
 * reading every moved row. A move carries both status ids, so it can be asked
 * directly.
 */
export const MOVE_DIRECTIONS = ["to", "from"] as const;

export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

/**
 * Stands in for "any status marked completed" rather than one named column.
 *
 * A workspace can have several completed statuses (Done, Shipped, Won't do),
 * and which ones exist changes; pinning the filter to today's names would make
 * a saved link quietly stop covering a status added later.
 */
export const COMPLETED_STATUS_TARGET = "completed";

export type MoveFilter = Record<MoveDirection, string[]>;

/** One filter entry, as it appears in the URL and in the menu's option list. */
export function moveFilterValue(direction: MoveDirection, target: string) {
  return `${direction}:${target}`;
}

export function parseMoveFilter(values: string[]): MoveFilter {
  const filter: MoveFilter = { to: [], from: [] };
  for (const value of values) {
    const separator = value.indexOf(":");
    if (separator < 0) continue;
    const direction = value.slice(0, separator);
    const target = value.slice(separator + 1);
    if (!target) continue;
    if (direction === "to" || direction === "from")
      filter[direction].push(target);
  }
  return filter;
}

export function moveFilterIsEmpty(filter: MoveFilter) {
  return !filter.to.length && !filter.from.length;
}

/**
 * The statuses one filter entry stands for, as ids.
 *
 * Resolved on the client, where the status list already is, so the feed does
 * not have to read statuses back to understand a request.
 */
export function resolveMoveTarget(target: string, statuses: Status[]) {
  if (target === COMPLETED_STATUS_TARGET) {
    const completed = statuses
      .filter((status) => status.is_completed)
      .map((status) => status.id);
    // With no completed status configured the sentinel matches no status id,
    // which is the honest answer -- dropping it would widen the filter to
    // every move instead of narrowing it to none.
    return completed.length ? completed : [target];
  }
  const status = statuses.find(
    (candidate) => candidate.id === target || candidate.name === target,
  );
  return [status?.id ?? target];
}

/** The status ids a move carries, or null when the event is not a move. */
export function activityStatusMove(
  item: Pick<TaskActivity, "action" | "details">,
) {
  if (item.action !== TASK_MOVE_ACTION) return null;
  const id = (value: unknown) => (typeof value === "string" ? value : null);
  return {
    from: id(item.details.from_status_id),
    to: id(item.details.status_id),
  };
}

type StatusMove = NonNullable<ReturnType<typeof activityStatusMove>>;

/**
 * Whether an event survives the included moves.
 *
 * The two directions are read together: "to Done" alone is everything that
 * landed in Done, and adding "from In progress" narrows that to the one
 * transition rather than widening it to a second pile of rows. Within a
 * direction the entries are alternatives, so "to Done, to Shipped" is either.
 *
 * Any include at all restricts the feed to moves -- a note edit has no status
 * to have landed in, so it cannot answer the question being asked.
 */
export function matchesIncludedMoves(
  move: StatusMove | null,
  filter: MoveFilter,
) {
  if (moveFilterIsEmpty(filter)) return true;
  if (!move) return false;
  const matches = (targets: string[], statusId: string | null) =>
    !targets.length || (statusId !== null && targets.includes(statusId));
  return matches(filter.to, move.to) && matches(filter.from, move.from);
}

/** Whether an event is dropped by the excluded moves. Non-moves never are. */
export function matchesExcludedMoves(
  move: StatusMove | null,
  filter: MoveFilter,
) {
  if (!move) return false;
  return MOVE_DIRECTIONS.some((direction) => {
    const statusId = move[direction];
    return statusId !== null && filter[direction].includes(statusId);
  });
}
