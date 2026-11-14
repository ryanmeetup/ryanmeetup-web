"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AnimatedCollapse,
  Avatar,
  Card,
  EmptyState,
  IconButton,
} from "@ryanmeetup/ui";
import {
  FiArrowRight,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import type { Status, Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { withAccessPreview } from "@/lib/access/access-preview";
import { taskPath } from "@/lib/tasks/task-key";
import { profileDisplayName } from "@/lib/presentation";
import { TaskKeyBadge } from "@/components/tasks";
import { formatCalendarDay } from "@/lib/date-format";

export const widgetPageSize = 5;

export const boundedWidgetPage = (page: number, total: number) =>
  Math.min(page, Math.max(0, Math.ceil(total / widgetPageSize) - 1));

export function StatusBadge({ status }: { status?: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-black/65 dark:text-white/65">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: status?.color ?? "#999" }}
      />
      {status?.name ?? "Unknown"}
    </span>
  );
}

export function DashboardTaskList({
  data,
  empty,
  tasks,
}: {
  data: WorkspaceData;
  empty: string;
  tasks: Task[];
}) {
  const statuses = new Map(data.statuses.map((status) => [status.id, status]));
  const profiles = new Map(
    data.profiles.map((profile) => [profile.id, profile]),
  );
  if (!tasks.length) return <EmptyState variant="plain" message={empty} />;
  return (
    <ul className="divide-y divide-black/10 dark:divide-white/10">
      {tasks.map((task) => {
        const assignees = data.taskAssignees
          .filter((row) => row.task_id === task.id)
          .flatMap((row) => {
            const profile = profiles.get(row.profile_id);
            return profile ? [profile] : [];
          });
        const assignee = assignees[0];
        return (
          <li key={task.id}>
            <Link
              href={withAccessPreview(taskPath(task), data.accessPreview)}
              className="group grid gap-3 px-4 py-4 transition hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:bg-white/[0.035] dark:focus-visible:ring-white/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="min-w-0">
                <span className="text-sm font-semibold group-hover:underline">
                  <TaskKeyBadge task={task} className="mr-2 align-middle" />
                  {task.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge status={statuses.get(task.status_id)} />
                  <span className="inline-flex items-center gap-1.5 text-xs text-black/55 dark:text-white/55">
                    <Avatar
                      name={
                        assignee ? profileDisplayName(assignee) : "Unassigned"
                      }
                      src={assignee?.avatar_url}
                      size="sm"
                    />
                    {assignee
                      ? `${profileDisplayName(assignee)}${assignees.length > 1 ? ` +${assignees.length - 1}` : ""}`
                      : "Unassigned"}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs font-medium text-black/50 dark:text-white/50">
                {task.due_date
                  ? formatCalendarDay(task.due_date)
                  : "No due date"}
                <FiArrowRight className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SectionCard({
  action,
  children,
  icon,
  tone = "neutral",
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  icon: ReactNode;
  tone?: "blue" | "gold" | "green" | "neutral" | "violet";
  title: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const contentId = useId();
  const toneStyles = {
    blue: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-200",
    gold: "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200",
    green:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200",
    neutral: "bg-black/5 text-black/55 dark:bg-white/10 dark:text-white/60",
    violet:
      "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200",
  };
  return (
    <Card
      size="none"
      className="overflow-hidden bg-white/90 shadow-sm dark:bg-white/[0.055] dark:shadow-none"
    >
      <div
        className={`flex items-center gap-3 px-4 py-3.5 ${collapsed ? "" : "border-b border-black/[0.07] dark:border-white/10"}`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneStyles[tone]}`}
        >
          {icon}
        </span>
        <h2 className="text-section-title font-semibold">{title}</h2>
        <span className="ml-auto flex items-center gap-2">
          {action}
          <IconButton
            label={`${collapsed ? "Expand" : "Collapse"} “${title}”`}
            size="sm"
            aria-controls={contentId}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((current) => !current)}
          >
            <FiChevronDown
              className={`transition-transform duration-200 motion-reduce:transition-none ${collapsed ? "-rotate-90" : ""}`}
            />
          </IconButton>
        </span>
      </div>
      <AnimatedCollapse id={contentId} open={!collapsed}>
        {children}
      </AnimatedCollapse>
    </Card>
  );
}

export function WidgetPagination({
  label,
  onPageChange,
  page,
  total,
}: {
  label: string;
  onPageChange: (page: number) => void;
  page: number;
  total: number;
}) {
  if (total === 0) return null;
  const pageCount = Math.ceil(total / widgetPageSize);
  const start = page * widgetPageSize + 1;
  const end = Math.min(start + widgetPageSize - 1, total);
  return (
    <div className="flex items-center gap-3 border-t border-black/[0.07] px-4 py-3 dark:border-white/10">
      <p className="mr-auto text-xs font-medium text-black/55 dark:text-white/55">
        Showing {start}–{end} of {total}
      </p>
      <IconButton
        label={`Previous page of “${label}”`}
        size="sm"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        <FiChevronLeft />
      </IconButton>
      <IconButton
        label={`Next page of “${label}”`}
        size="sm"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
      >
        <FiChevronRight />
      </IconButton>
    </div>
  );
}
