import { Fragment } from "react";
import {
  AnimatedCollapse,
  Avatar,
  EmptyState,
  Tooltip,
} from "@ryanmeetup/ui";
import { FiChevronDown } from "react-icons/fi";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import type { Status, Task } from "@/lib/tasks/task-types";
import { formatMonth, formatTimestampDate } from "@/lib/date-format";
import { profileDisplayName } from "@/lib/presentation";
import { TaskCategoryBadge } from "./TaskCategoryBadge";
import { TaskDueDate } from "./TaskDueDate";
import { TaskKeyBadge } from "./TaskKeyBadge";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import type { TaskListData } from "./TaskListView";
import { closesWork } from "@/lib/tasks/status-outcome";

type TaskListItem = {
  task: Task;
  status?: Status;
  categories: Category[];
  project?: Project | null;
  people: Profile[];
};

type MonthDisclosure = {
  collapsedMonths: ReadonlySet<string>;
  idPrefix: string;
  onToggleMonth: (key: string) => void;
};

function MonthDisclosureButton({
  collapsed,
  label,
  onClick,
  panelId,
}: {
  collapsed: boolean;
  label: string;
  onClick: () => void;
  panelId: string;
}) {
  return (
    <button
      type="button"
      aria-controls={panelId}
      aria-expanded={!collapsed}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-black/60 transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:text-white/60 dark:hover:bg-white/[0.04] dark:focus-visible:ring-white/30"
    >
      {label}
      <FiChevronDown
        aria-hidden
        className={`shrink-0 text-sm transition-transform duration-200 motion-reduce:transition-none ${collapsed ? "-rotate-90" : ""}`}
      />
    </button>
  );
}

/**
 * Archived rows read as a record of what happened, so they are grouped by the
 * month work closed rather than running as one undifferentiated list. Anything
 * without a closing date sits in its own group; a task can only get
 * there by having its status reopened after it was archived.
 */
export function groupTasksByClosedMonth(items: TaskListItem[]) {
  const groups: { key: string; label: string; items: TaskListItem[] }[] = [];
  const byMonth = new Map<string, (typeof groups)[number]>();
  for (const item of items) {
    const closedAt = item.task.completed_at;
    const key = closedAt ? closedAt.slice(0, 7) : "unknown";
    const label = closedAt ? formatMonth(closedAt) : "No closing date";
    const group = byMonth.get(key);
    if (group) group.items.push(item);
    else {
      const next = { key, label, items: [item] };
      byMonth.set(key, next);
      groups.push(next);
    }
  }
  return groups;
}

export function resolveTaskListItems(data: TaskListData): TaskListItem[] {
  return data.tasks.map((task) => ({
    task,
    status: data.statuses.find((status) => status.id === task.status_id),
    categories: [...(data.categoriesByTask.get(task.id) ?? [])]
      .map((id) => data.categories.get(id))
      .filter((category): category is Category => Boolean(category)),
    project: task.project_id ? data.projects.get(task.project_id) : null,
    people: [...(data.assigneesByTask.get(task.id) ?? [])]
      .map((id) => data.profiles.get(id))
      .filter((profile): profile is Profile => Boolean(profile)),
  }));
}

function Assignees({
  people,
  compact = false,
}: {
  people: Profile[];
  compact?: boolean;
}) {
  if (people.length === 0) return compact ? null : <>Unassigned</>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="flex shrink-0 -space-x-1.5">
        {people.slice(0, 3).map((person) => (
          <Tooltip
            key={person.id}
            content={profileDisplayName(person)}
            placement="top"
          >
            <Avatar
              name={profileDisplayName(person)}
              size="sm"
              src={person.avatar_url}
            />
          </Tooltip>
        ))}
      </span>
      <span className="truncate">
        {people.map((person) => profileDisplayName(person)).join(", ")}
      </span>
    </span>
  );
}

export function TaskListCards({
  items,
  archived = false,
  grouped = archived,
  monthDisclosure,
  onOpenTask,
}: {
  items: TaskListItem[];
  archived?: boolean;
  grouped?: boolean;
  monthDisclosure: MonthDisclosure;
  onOpenTask: (task: Task) => void;
}) {
  if (items.length === 0)
    return (
      <EmptyState
        variant="plain"
        message={
          archived
            ? "Nothing archived yet. Finished and declined work moves here once it has been closed for two weeks."
            : "No tasks found. Try clearing a filter or add the first task in this view."
        }
      />
    );
  if (grouped)
    return groupTasksByClosedMonth(items).map((group) => {
      const collapsed = monthDisclosure.collapsedMonths.has(group.key);
      const panelId = `${monthDisclosure.idPrefix}-mobile-${group.key}`;
      return (
        <div key={group.key}>
          <div className="bg-black/[0.025] dark:bg-white/[0.025]">
            <MonthDisclosureButton
              collapsed={collapsed}
              label={group.label}
              panelId={panelId}
              onClick={() => monthDisclosure.onToggleMonth(group.key)}
            />
          </div>
          <AnimatedCollapse id={panelId} open={!collapsed}>
            <div className="divide-y divide-black/5 dark:divide-white/5">
              <TaskListCards
                items={group.items}
                archived={archived}
                grouped={false}
                monthDisclosure={monthDisclosure}
                onOpenTask={onOpenTask}
              />
            </div>
          </AnimatedCollapse>
        </div>
      );
    });
  return items.map(({ task, status, categories, project, people }) => (
    <button
      type="button"
      key={task.id}
      onClick={() => onOpenTask(task)}
      className="block w-full p-4 text-left transition hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:bg-white/[0.025] dark:focus-visible:ring-white/30"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 font-semibold leading-snug">
          <TaskKeyBadge task={task} className="mr-2 align-middle" />
          {task.title}
        </span>
        <TaskPriorityBadge priority={task.priority} />
      </span>
      <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-black/60 dark:text-white/60">
        {status && (
          <span className="inline-flex items-center gap-1.5 font-medium text-black/75 dark:text-white/75">
            <i
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            {status.name}
          </span>
        )}
        {project && <span>{project.name}</span>}
        <Assignees people={people} compact />
        {archived ? (
          task.completed_at && (
            <span>Closed {formatTimestampDate(task.completed_at)}</span>
          )
        ) : task.due_date ? (
          <TaskDueDate
            dueDate={task.due_date}
            isCompleted={status ? closesWork(status) : false}
            showIcon
          />
        ) : null}
      </span>
      {categories.length > 0 && (
        <span className="mt-3 flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <TaskCategoryBadge
              key={category.id}
              category={category}
              tags={task.category_tags?.[category.id]}
            />
          ))}
        </span>
      )}
    </button>
  ));
}

export function TaskListRows({
  items,
  archived = false,
  grouped = archived,
  monthDisclosure,
  onOpenTask,
}: {
  items: TaskListItem[];
  /** Show when work closed rather than when it was due. */
  archived?: boolean;
  /** Split the rows into month headings. Off for the rows inside one. */
  grouped?: boolean;
  monthDisclosure: MonthDisclosure;
  onOpenTask: (task: Task) => void;
}) {
  if (items.length === 0)
    return (
      <tr>
        <td colSpan={7}>
          <EmptyState
            variant="plain"
            message={
              archived
                ? "Nothing archived yet. Finished and declined work moves here once it has been closed for two weeks."
                : "No tasks found. Try clearing a filter or add the first task in this view."
            }
          />
        </td>
      </tr>
    );
  if (grouped)
    return groupTasksByClosedMonth(items).map((group) => {
      const collapsed = monthDisclosure.collapsedMonths.has(group.key);
      const panelId = `${monthDisclosure.idPrefix}-desktop-${group.key}`;
      return (
        <Fragment key={group.key}>
          <tr>
            <th
              scope="colgroup"
              colSpan={7}
              className="bg-black/[0.025] p-0 text-left dark:bg-white/[0.025]"
            >
              <MonthDisclosureButton
                collapsed={collapsed}
                label={group.label}
                panelId={panelId}
                onClick={() => monthDisclosure.onToggleMonth(group.key)}
              />
            </th>
          </tr>
          <tr>
            <td colSpan={7} className="p-0">
              <AnimatedCollapse id={panelId} open={!collapsed}>
                <table className="w-full table-fixed text-left">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[9%]" />
                    <col className="w-[19%]" />
                    <col className="w-[14%]" />
                    <col className="w-[9%]" />
                    <col className="w-[7%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Task</th>
                      <th scope="col">Status</th>
                      <th scope="col">Categories</th>
                      <th scope="col">Project</th>
                      <th scope="col">Assignee</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Closed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    <TaskListRows
                      items={group.items}
                      archived={archived}
                      grouped={false}
                      monthDisclosure={monthDisclosure}
                      onOpenTask={onOpenTask}
                    />
                  </tbody>
                </table>
              </AnimatedCollapse>
            </td>
          </tr>
        </Fragment>
      );
    });
  return items.map(({ task, status, categories, project, people }) => (
    <tr
      key={task.id}
      onClick={() => onOpenTask(task)}
      className="cursor-pointer text-sm hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"
    >
      <td className="px-4 py-4">
        <span className="font-semibold">
          <TaskKeyBadge task={task} className="mr-2 align-middle" />
          {task.title}
        </span>
      </td>
      <td className="px-3 py-4">
        <span className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
          <i
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: status?.color }}
          />
          {status?.name}
        </span>
      </td>
      <td className="px-3 py-4">
        {categories.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <TaskCategoryBadge
                key={category.id}
                category={category}
                tags={task.category_tags?.[category.id]}
              />
            ))}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-4">{project?.name ?? "—"}</td>
      <td className="px-3 py-4">
        <Assignees people={people} />
      </td>
      <td className="px-3 py-4">
        <TaskPriorityBadge priority={task.priority} />
      </td>
      <td className="px-3 py-4">
        {archived ? (
          <span className="whitespace-nowrap text-sm text-black/80 dark:text-white/80">
            {task.completed_at ? formatTimestampDate(task.completed_at) : "—"}
          </span>
        ) : (
          <TaskDueDate
            dueDate={task.due_date}
            isCompleted={status ? closesWork(status) : false}
            size="list"
          />
        )}
      </td>
    </tr>
  ));
}
