import { Avatar, EmptyState } from "@ryanmeetup/ui";
import type { Category, Project } from "@/lib/resources/resource-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import type { Status, Task } from "@/lib/tasks/task-types";
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
          <Avatar
            key={person.id}
            name={profileDisplayName(person)}
            size="sm"
            src={person.avatar_url}
          />
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
  onOpenTask,
}: {
  items: TaskListItem[];
  onOpenTask: (task: Task) => void;
}) {
  if (items.length === 0)
    return (
      <EmptyState
        variant="plain"
        message="No tasks found. Try clearing a filter or add the first task in this view."
      />
    );
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
        {task.due_date && (
          <TaskDueDate
            dueDate={task.due_date}
            isCompleted={status ? closesWork(status) : false}
            showIcon
          />
        )}
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
  onOpenTask,
}: {
  items: TaskListItem[];
  onOpenTask: (task: Task) => void;
}) {
  if (items.length === 0)
    return (
      <tr>
        <td colSpan={7}>
          <EmptyState
            variant="plain"
            message="No tasks found. Try clearing a filter or add the first task in this view."
          />
        </td>
      </tr>
    );
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
        <TaskDueDate
          dueDate={task.due_date}
          isCompleted={status ? closesWork(status) : false}
          size="list"
        />
      </td>
    </tr>
  ));
}
