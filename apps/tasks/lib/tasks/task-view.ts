import type {
  Priority,
  Task,
  TaskAssignee,
  TaskCategory,
} from "@/lib/tasks/task-types";
import { localDateValue } from "@/lib/tasks/task-scheduling";
import { taskPriorities } from "@/lib/tasks/task-filter-values";
import type { CategoryTagFilter } from "@/lib/tasks/task-filter-values";

export function indexTaskCategories(rows: TaskCategory[]) {
  const result = new Map<string, Set<string>>();
  rows.forEach((row) => {
    const ids = result.get(row.task_id) ?? new Set<string>();
    ids.add(row.category_id);
    result.set(row.task_id, ids);
  });
  return result;
}

export function indexTaskAssignees(rows: TaskAssignee[] = []) {
  const result = new Map<string, Set<string>>();
  rows.forEach((row) => {
    const ids = result.get(row.task_id) ?? new Set<string>();
    ids.add(row.profile_id);
    result.set(row.task_id, ids);
  });
  return result;
}

export function taskHasAssignee(
  assigneesByTask: Map<string, Set<string>>,
  taskId: string,
  assigneeId: string,
) {
  const assigneeIds = assigneesByTask.get(taskId);
  return assigneeId === "unassigned"
    ? !assigneeIds?.size
    : Boolean(assigneeIds?.has(assigneeId));
}

export function taskMatchesDueFilter(
  task: Pick<Task, "due_date">,
  value: string,
  clock: number,
) {
  if (!task.due_date) return false;
  const today = localDateValue(new Date(clock));
  if (value === "overdue") return task.due_date < today;
  return (
    task.due_date >= today &&
    task.due_date <=
      localDateValue(new Date(clock + Number.parseInt(value, 10) * 86_400_000))
  );
}

type TaskViewFilters = {
  assignees: string[];
  excludedAssignees: string[];
  reporters: string[];
  excludedReporters: string[];
  categories: string[];
  excludedCategories: string[];
  projects: string[];
  excludedProjects: string[];
  statuses: string[];
  excludedStatuses: string[];
  priorities: Priority[];
  excludedPriorities: Priority[];
  dueWithin: string[];
  excludedDueWithin: string[];
  tags: CategoryTagFilter[];
  excludedTags: CategoryTagFilter[];
};

export const taskSorts: readonly string[] = [
  "updated",
  "due",
  "priority",
  "closed",
];

export function deriveVisibleTasks({
  assigneesByTask,
  categoriesByTask,
  clock,
  filters,
  sort,
  tasks,
  view,
  visibility,
}: {
  assigneesByTask: Map<string, Set<string>>;
  categoriesByTask: Map<string, Set<string>>;
  clock: number;
  filters: TaskViewFilters;
  sort: string;
  tasks: Task[];
  view: "board" | "list";
  visibility: "active" | "archived";
}) {
  return tasks
    .filter(
      (task) =>
        (filters.assignees.length === 0 ||
          filters.assignees.some((id) =>
            taskHasAssignee(assigneesByTask, task.id, id),
          )) &&
        !filters.excludedAssignees.some((id) =>
          taskHasAssignee(assigneesByTask, task.id, id),
        ) &&
        (filters.reporters.length === 0 ||
          filters.reporters.includes(task.reported_by ?? "")) &&
        !filters.excludedReporters.includes(task.reported_by ?? "") &&
        (filters.categories.length === 0 ||
          filters.categories.some((id) =>
            categoriesByTask.get(task.id)?.has(id),
          )) &&
        !filters.excludedCategories.some((id) =>
          categoriesByTask.get(task.id)?.has(id),
        ) &&
        (filters.projects.length === 0 ||
          filters.projects.some((id) =>
            id === "none" ? task.project_id === null : task.project_id === id,
          )) &&
        !filters.excludedProjects.some((id) =>
          id === "none" ? task.project_id === null : task.project_id === id,
        ) &&
        (filters.statuses.length === 0 ||
          filters.statuses.includes(task.status_id)) &&
        !filters.excludedStatuses.includes(task.status_id) &&
        (filters.priorities.length === 0 ||
          filters.priorities.includes(task.priority)) &&
        !filters.excludedPriorities.includes(task.priority) &&
        (filters.dueWithin.length === 0 ||
          filters.dueWithin.some((value) =>
            taskMatchesDueFilter(task, value, clock),
          )) &&
        !filters.excludedDueWithin.some((value) =>
          taskMatchesDueFilter(task, value, clock),
        ) &&
        (filters.tags.length === 0 ||
          filters.tags.some(({ categoryId, tag }) =>
            task.category_tags?.[categoryId]?.includes(tag),
          )) &&
        !filters.excludedTags.some(({ categoryId, tag }) =>
          task.category_tags?.[categoryId]?.includes(tag),
        ) &&
        (visibility === "archived"
          ? Boolean(
              task.archived_at && new Date(task.archived_at).getTime() <= clock,
            )
          : !task.archived_at || new Date(task.archived_at).getTime() > clock),
    )
    .sort((a, b) =>
      view === "board"
        ? a.board_position - b.board_position
        : sort === "due"
          ? (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
          : sort === "priority"
            ? taskPriorities.indexOf(b.priority) -
              taskPriorities.indexOf(a.priority)
            : sort === "closed"
              ? (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
              : b.updated_at.localeCompare(a.updated_at),
    );
}
