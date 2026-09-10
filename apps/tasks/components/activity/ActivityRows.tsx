import Link from "next/link";
import { EmptyState, Spinner } from "@ryanmeetup/ui";
import { CategoryLabel } from "@/components/categories";
import { TaskKeyBadge } from "@/components/tasks";
import { withAccessPreview } from "@/lib/access/access-preview";
import type {
  ActivityPresentationRow,
  ActivityDescription,
} from "@/lib/activity/activity-presentation";
import { formatTimestamp } from "@/lib/date-format";
import { taskPath } from "@/lib/tasks/task-key";
import type { AccessPreview } from "@/lib/workspace/workspace-types";
import { ActivityActorAvatar } from "./ActivityActorAvatar";
import {
  ActivityChangeList,
  ActivityStatusChange,
  activityChangeSummary,
} from "./ActivityChangeList";

function activityDescription(
  description: ActivityDescription,
  { compact = false }: { compact?: boolean } = {},
) {
  if (description.kind === "changes") {
    return compact ? (
      activityChangeSummary(description.changes)
    ) : (
      <div className="space-y-1">
        <p>{description.label}</p>
        <ActivityChangeList changes={description.changes} />
      </div>
    );
  }
  if (description.kind === "status") {
    return (
      <ActivityStatusChange from={description.from} to={description.to} />
    );
  }
  return description.detail ? (
    <span>
      {description.label}
      <span className="text-black/55 dark:text-white/55">
        {" \u2014 "}
        {description.detail}
      </span>
    </span>
  ) : (
    description.label
  );
}

function activityHref(row: ActivityPresentationRow, preview?: AccessPreview) {
  return row.task
    ? withAccessPreview(taskPath(row.task), preview)
    : row.resourceHref;
}

function activityItemName(row: ActivityPresentationRow) {
  return row.task?.title ?? row.resourceName ?? "item";
}

export function ActivityRows({
  emptyMessage,
  loading = false,
  preview,
  rows,
  showMobileHeader = true,
  showProject = true,
}: {
  emptyMessage: string;
  loading?: boolean;
  preview?: AccessPreview;
  rows: ActivityPresentationRow[];
  showMobileHeader?: boolean;
  showProject?: boolean;
}) {
  return (
    <div className="@container">
      <div className="@min-[64rem]:hidden" aria-busy={loading}>
        {showMobileHeader && (
          <div className="border-b border-black/10 bg-black/[0.025] px-4 py-3 dark:border-white/10 dark:bg-white/[0.025]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/50 dark:text-white/50">
              Activity
            </p>
          </div>
        )}
        <div className="divide-y divide-black/10 dark:divide-white/10">
          {rows.map((row) => {
            const { item, task, actor, project, category, resourceName } = row;
            const href = activityHref(row, preview);
            const content = (
              <article className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <ActivityActorAvatar profile={actor} />
                    <span className="truncate">{row.actorName}</span>
                  </span>
                  <time
                    dateTime={item.created_at}
                    className="shrink-0 text-right text-xs text-black/55 dark:text-white/55"
                  >
                    {formatTimestamp(item.created_at)}
                  </time>
                </div>
                <div className="text-sm">
                  {activityDescription(row.description)}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  {task ? (
                    <span className="min-w-0 font-semibold">
                      <TaskKeyBadge task={task} className="mr-2 align-middle" />
                      <span>{task.title}</span>
                    </span>
                  ) : resourceName ? (
                    category ? (
                      <CategoryLabel
                        category={category}
                        className="font-semibold"
                      />
                    ) : (
                      <span className="min-w-0 font-semibold">
                        {resourceName}
                      </span>
                    )
                  ) : (
                    <span className="text-black/45 dark:text-white/45">
                      Item unavailable
                    </span>
                  )}
                  {showProject && project && (
                    <span className="text-black/60 dark:text-white/60">
                      {project.name}
                    </span>
                  )}
                </div>
              </article>
            );
            return href ? (
              <Link
                key={item.id}
                href={href}
                className="block transition hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:bg-white/[0.025] dark:focus-visible:ring-white/40"
                aria-label={`Open ${activityItemName(row)}`}
              >
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
          {loading && rows.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-black/60 dark:text-white/60">
              <Spinner size={18} label="Loading activity" />
              <span>Loading activity…</span>
            </div>
          )}
          {!loading && rows.length === 0 && (
            <EmptyState variant="plain" message={emptyMessage} />
          )}
        </div>
      </div>

      <div
        className="hidden overflow-x-auto @min-[64rem]:block"
        aria-busy={loading}
      >
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <colgroup>
            <col className={showProject ? "w-[20%] xl:w-[18%]" : "w-[22%]"} />
            <col className={showProject ? "w-[22%] xl:w-[18%]" : "w-[23%]"} />
            <col className={showProject ? "w-[21%] xl:w-[19%]" : "w-[25%]"} />
            <col className={showProject ? "w-[23%] xl:w-[30%]" : "w-[30%]"} />
            {showProject && <col className="w-[14%] xl:w-[15%]" />}
          </colgroup>
          <thead className="border-b border-black/10 bg-black/[0.025] text-[10px] uppercase tracking-[0.16em] text-black/50 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/50">
            <tr>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Who</th>
              <th className="px-4 py-3 font-semibold">What happened</th>
              <th className="px-4 py-3 font-semibold">Item</th>
              {showProject && (
                <th className="px-4 py-3 font-semibold">Project</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {rows.map((row) => {
              const { item, task, actor, project, category, resourceName } =
                row;
              const href = activityHref(row, preview);
              return (
                <tr
                  key={item.id}
                  className="group relative align-middle transition hover:bg-black/[0.025] focus-within:bg-black/[0.025] dark:hover:bg-white/[0.025] dark:focus-within:bg-white/[0.025]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-black/55 dark:text-white/55">
                    {href && (
                      <Link
                        href={href}
                        aria-label={`Open ${activityItemName(row)}`}
                        className="absolute inset-0 z-10 focus-visible:outline-none group-focus-within:ring-2 group-focus-within:ring-inset group-focus-within:ring-black/30 dark:group-focus-within:ring-white/40"
                      />
                    )}
                    <time dateTime={item.created_at}>
                      {formatTimestamp(item.created_at)}
                    </time>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="flex items-center gap-2 font-semibold">
                      <ActivityActorAvatar profile={actor} />
                      {row.actorName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="truncate">
                      {activityDescription(row.description, { compact: true })}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {task ? (
                      <span className="flex min-w-0 items-start gap-2">
                        <TaskKeyBadge task={task} className="mt-0.5 shrink-0" />
                        <span className="min-w-0">{task.title}</span>
                      </span>
                    ) : resourceName ? (
                      category ? (
                        <CategoryLabel category={category} />
                      ) : (
                        <span className="min-w-0">{resourceName}</span>
                      )
                    ) : (
                      <span className="text-black/45 dark:text-white/45">
                        Item unavailable
                      </span>
                    )}
                  </td>
                  {showProject && (
                    <td className="px-4 py-3 text-black/65 dark:text-white/65">
                      {project?.name ?? "—"}
                    </td>
                  )}
                </tr>
              );
            })}
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={showProject ? 5 : 4}>
                  <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-black/60 dark:text-white/60">
                    <Spinner size={18} label="Loading activity" />
                    <span>Loading activity…</span>
                  </div>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={showProject ? 5 : 4}>
                  <EmptyState variant="plain" message={emptyMessage} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
