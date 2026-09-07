import { Avatar, FormattedText } from "@ryanmeetup/ui";
import Link from "next/link";
import type { DragEvent } from "react";
import { FiExternalLink, FiFolder, FiUsers } from "react-icons/fi";
import type {
  Category,
  Project,
} from "@/lib/resources/resource-types";
import type { Profile } from "@/lib/workspace/workspace-types";
import type {
  Status,
  Subtask,
  Task,
} from "@/lib/tasks/task-types";
import { profileDisplayName } from "@/lib/presentation";
import { taskPath } from "@/lib/tasks/task-key";
import { TaskCategoryBadge } from "./TaskCategoryBadge";
import { TaskDueDate } from "./TaskDueDate";
import { TaskKeyBadge } from "./TaskKeyBadge";
import { TaskPriorityBadge } from "./TaskPriorityBadge";

export type TaskDropEdge = "before" | "after";

type TaskBoardCardProps = {
  task: Task;
  status?: Status;
  categories: Category[];
  people: Profile[];
  project?: Project | null;
  subtasks: Subtask[];
  draggedTaskId: string | null;
  dropTarget: { taskId: string; edge: TaskDropEdge } | null;
  onDragStart: (taskId: string) => void;
  onDragOver: (task: Task, edge: TaskDropEdge) => void;
  onDrop: (task: Task, draggedTaskId: string, edge: TaskDropEdge) => void;
  onDragEnd: () => void;
  onOpen: (task: Task) => void;
};

function edgeFromPointer(clientY: number, element: HTMLElement): TaskDropEdge {
  const bounds = element.getBoundingClientRect();
  return clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}

function setDragPreview(
  event: DragEvent<HTMLDivElement>,
  source: HTMLDivElement,
) {
  const bounds = source.getBoundingClientRect();
  const previewFrame = document.createElement("div");
  const previewCard = source.cloneNode(true) as HTMLDivElement;
  previewFrame.setAttribute("aria-hidden", "true");
  previewFrame.style.position = "fixed";
  previewFrame.style.top = "-2000px";
  previewFrame.style.left = "-2000px";
  previewFrame.style.width = `${bounds.width + 32}px`;
  previewFrame.style.height = `${bounds.height + 32}px`;
  previewFrame.style.pointerEvents = "none";
  previewCard.style.position = "absolute";
  previewCard.style.top = "16px";
  previewCard.style.left = "16px";
  previewCard.style.width = `${bounds.width}px`;
  previewCard.style.transform = "translate(8px, -5px) rotate(2.5deg)";
  previewCard.style.transformOrigin = "center";
  previewCard.style.boxShadow = "0 18px 40px rgb(0 0 0 / 0.2)";
  previewCard.style.opacity = "0.92";
  previewFrame.append(previewCard);
  document.body.append(previewFrame);
  event.dataTransfer.setDragImage(
    previewFrame,
    event.clientX - bounds.left + 16,
    event.clientY - bounds.top + 16,
  );
  window.setTimeout(() => previewFrame.remove(), 0);
}

export function TaskBoardCard({
  task,
  status,
  categories,
  people,
  project,
  subtasks,
  draggedTaskId,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onOpen,
}: TaskBoardCardProps) {
  const completedSubtasks = subtasks.filter((item) => item.is_completed).length;

  return (
    <div
      draggable
      onDragStart={(event) => {
        onDragStart(task.id);
        event.dataTransfer.setData("text/task-id", task.id);
        event.dataTransfer.effectAllowed = "move";
        setDragPreview(event, event.currentTarget);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (draggedTaskId === task.id) return;
        onDragOver(task, edgeFromPointer(event.clientY, event.currentTarget));
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop(
          task,
          event.dataTransfer.getData("text/task-id"),
          edgeFromPointer(event.clientY, event.currentTarget),
        );
      }}
      onDragEnd={onDragEnd}
      className={`group relative isolate w-full cursor-grab rounded-xl border border-black/10 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-black/25 hover:shadow-md active:cursor-grabbing sm:p-4 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/30 ${
        dropTarget?.taskId === task.id
          ? dropTarget.edge === "before"
            ? "relative before:absolute before:-top-2 before:right-2 before:left-2 before:h-1 before:rounded-full before:bg-blue-500 before:content-[''] dark:before:bg-blue-400"
            : "relative after:absolute after:-right-2 after:-bottom-2 after:left-2 after:h-1 after:rounded-full after:bg-blue-500 after:content-[''] dark:after:bg-blue-400"
          : ""
      }`}
    >
      <button
        type="button"
        aria-label={`Open ${task.title}`}
        onClick={() => onOpen(task)}
        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/20 dark:focus-visible:ring-white/30"
      />
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3 sm:gap-3">
        <TaskKeyBadge task={task} />
        <span className="flex shrink-0 items-center gap-1.5">
          <TaskPriorityBadge priority={task.priority} size="compact" />
          <Link
            href={taskPath(task)}
            aria-label={`Go to ${task.title} details`}
            title="Open task details"
            draggable={false}
            className="relative z-10 rounded p-0.5 text-black/40 transition hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/40 dark:hover:text-white dark:focus-visible:ring-white/40"
          >
            <FiExternalLink aria-hidden="true" />
          </Link>
        </span>
      </div>
      <h3 className="text-sm font-semibold leading-snug text-black sm:text-base dark:text-white">
        {task.title}
      </h3>
      {task.description && (
        <FormattedText
          text={task.description}
          className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-black/60 sm:mt-2 sm:text-xs dark:text-white/60"
        />
      )}
      {subtasks.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-3">
          <span className="ml-auto text-[10px] font-semibold text-black/50 dark:text-white/50">
            ✓ {completedSubtasks}/{subtasks.length}
          </span>
        </div>
      )}
      {categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 sm:mt-4">
          {categories.map((category) => (
            <TaskCategoryBadge
              key={category.id}
              category={category}
              tags={task.category_tags?.[category.id]}
            />
          ))}
        </div>
      )}
      <div
        className={`${categories.length > 0 ? "mt-2" : "mt-3 sm:mt-4"} flex items-end justify-between gap-2 sm:gap-3`}
      >
        <div className="min-w-0 flex-1 space-y-2">
          {project && (
            <span className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-black/60 dark:text-white/60">
              <FiFolder className="shrink-0" />
              {project.name}
            </span>
          )}
          {task.due_date && (
            <TaskDueDate
              dueDate={task.due_date}
              isCompleted={status?.is_completed ?? false}
              showIcon
            />
          )}
        </div>
        {people.length > 0 ? (
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
        ) : (
          <span
            title="Unassigned"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-black/30 text-black/40 dark:border-white/30 dark:text-white/40"
          >
            <FiUsers size={12} />
          </span>
        )}
      </div>
    </div>
  );
}
