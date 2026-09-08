import { formatCalendarDate } from "@/lib/date-format";
import { projectTimeline } from "@/lib/resources/project-timeline";
import type { Project } from "@/lib/resources/resource-types";

const dueToneClass = {
  danger: "text-red-700 dark:text-red-300",
  warning: "text-amber-700 dark:text-amber-300",
  neutral: "text-black/55 dark:text-white/55",
} as const;

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-black/45 dark:text-white/45">
        {label}
      </dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

/**
 * When a project opened, how long it has been going, and when it is meant to
 * land. Every row is derived: a project that has recorded no dates of its own
 * still answers the first two from the day it was added.
 */
export function ProjectTimelineSummary({
  project,
}: {
  project: Pick<
    Project,
    "created_at" | "start_date" | "due_date" | "archived_at"
  >;
}) {
  const { start, running, due } = projectTimeline(project);

  return (
    <dl className="space-y-3.5">
      <Row label="Started">
        <time className="text-sm font-semibold" dateTime={start.date}>
          {formatCalendarDate(start.date)}
        </time>
        {start.inferred && (
          <span className="mt-0.5 block text-xs text-black/50 dark:text-white/50">
            The day it was added here
          </span>
        )}
      </Row>
      <Row label={running.ended ? "Ran for" : "Running for"}>
        <span className="text-sm font-semibold">{running.label}</span>
      </Row>
      <Row label="Due">
        {due ? (
          <>
            <time className="text-sm font-semibold" dateTime={due.date}>
              {formatCalendarDate(due.date)}
            </time>
            <span
              className={`mt-0.5 block text-xs font-medium ${dueToneClass[due.tone]}`}
            >
              {due.label}
            </span>
          </>
        ) : (
          <span className="text-sm text-black/50 dark:text-white/50">
            Not set
          </span>
        )}
      </Row>
    </dl>
  );
}
