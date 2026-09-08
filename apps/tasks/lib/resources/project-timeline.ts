import { localDateValue } from "@/lib/tasks/task-scheduling";
import type { Project } from "./resource-types";

const dayMs = 24 * 60 * 60 * 1000;

/**
 * Calendar days between two `YYYY-MM-DD` values, anchored at midday so a
 * daylight-saving shift can never round a whole day away.
 */
export function calendarDayGap(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / dayMs,
  );
}

/**
 * A span of days in the largest unit that still reads honestly. Nobody counts
 * a project's age in days once it is months old, and "1.7 years" is not how
 * anyone says it either.
 */
export function formatDaySpan(days: number) {
  const count = Math.max(0, Math.round(days));
  if (count === 0) return "less than a day";
  if (count < 14) return `${count} ${count === 1 ? "day" : "days"}`;
  if (count < 60) {
    const weeks = Math.round(count / 7);
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  const totalMonths = Math.round(count / 30.44);
  if (totalMonths < 12)
    return `${totalMonths} ${totalMonths === 1 ? "month" : "months"}`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const yearLabel = `${years} ${years === 1 ? "year" : "years"}`;
  return months
    ? `${yearLabel}, ${months} ${months === 1 ? "month" : "months"}`
    : yearLabel;
}

export type ProjectDueState = {
  date: string;
  /** Negative once the date has passed. */
  daysRemaining: number;
  label: string;
  tone: "danger" | "warning" | "neutral";
};

export type ProjectTimeline = {
  start: {
    date: string;
    /**
     * True when the project never recorded a start date and the day it was
     * added to the workspace is standing in for one.
     */
    inferred: boolean;
  };
  /** How long the project has run, and whether it is still running. */
  running: { days: number; label: string; ended: boolean };
  due: ProjectDueState | null;
};

function dueState(date: string, todayValue: string): ProjectDueState {
  const daysRemaining = calendarDayGap(todayValue, date);
  if (daysRemaining < 0)
    return {
      date,
      daysRemaining,
      label: `${formatDaySpan(-daysRemaining)} overdue`,
      tone: "danger",
    };
  if (daysRemaining === 0)
    return { date, daysRemaining, label: "Due today", tone: "warning" };
  return {
    date,
    daysRemaining,
    label: `in ${formatDaySpan(daysRemaining)}`,
    tone: daysRemaining <= 14 ? "warning" : "neutral",
  };
}

/**
 * Everything the overview says about a project's dates.
 *
 * A project that has been archived stopped running when it was archived —
 * that is the only completion moment the workspace actually records, so a
 * finished project reports the span it ran for rather than one that keeps
 * growing after the work stopped.
 */
export function projectTimeline(
  project: Pick<
    Project,
    "created_at" | "start_date" | "due_date" | "archived_at"
  >,
  today = new Date(),
): ProjectTimeline {
  const todayValue = localDateValue(today);
  // `created_at` and `archived_at` are instants; the reader thinks in their
  // own calendar days, so both are collapsed the same way `today` is.
  const start = project.start_date
    ? { date: project.start_date, inferred: false }
    : { date: localDateValue(new Date(project.created_at)), inferred: true };
  const endValue = project.archived_at
    ? localDateValue(new Date(project.archived_at))
    : todayValue;
  const days = Math.max(0, calendarDayGap(start.date, endValue));
  return {
    start,
    running: {
      days,
      label: formatDaySpan(days),
      ended: Boolean(project.archived_at),
    },
    due: project.due_date ? dueState(project.due_date, todayValue) : null,
  };
}
