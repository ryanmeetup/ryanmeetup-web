"use client";

import type { ReactNode } from "react";
import { AnimatedCollapse, IconButton } from "@ryanmeetup/ui";
import { useSearchFilter } from "@ryanmeetup/hooks";
import { FiChevronDown, FiPlus } from "react-icons/fi";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { taskKey } from "@/lib/tasks/task-key";
import { BoardColumnSearch } from "./BoardColumnSearch";
import { BoardColumnTasks } from "./BoardColumnTasks";
import {
  boardColumnHeaderProps,
  boardColumnProps,
} from "@/hooks/useBoardStickyHeaders";

export function BoardColumn({
  status,
  tasks,
  collapsed,
  isDropTarget,
  onDragEnterColumn,
  onDragLeaveColumn,
  onDropOnColumn,
  onToggle,
  onCreate,
  renderTask,
}: {
  status: WorkspaceData["statuses"][number];
  tasks: Task[];
  collapsed: boolean;
  isDropTarget: boolean;
  onDragEnterColumn: () => void;
  onDragLeaveColumn: () => void;
  onDropOnColumn: (taskId: string) => void;
  onToggle: () => void;
  onCreate: () => void;
  renderTask: (task: Task) => ReactNode;
}) {
  const { query, setQuery, filtered, isPending } = useSearchFilter({
    data: tasks,
    buildHaystack: (task) =>
      `${taskKey(task)} ${task.title} ${task.description ?? ""}`.toLowerCase(),
    queryParam: `column-${status.id}`,
  });

  return (
    <section
      {...boardColumnProps}
      aria-busy={isPending}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragEnterColumn();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next))
          onDragLeaveColumn();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDropOnColumn(event.dataTransfer.getData("text/task-id"));
      }}
      className={`${collapsed ? "w-[168px] sm:w-[240px]" : "w-[min(240px,70vw)] sm:w-[min(320px,calc(100vw-3rem))]"} group/column relative mb-6 shrink-0 rounded-2xl p-2 transition-[width,background-color,box-shadow] sm:p-3 ${isDropTarget ? "bg-[#d9dcd7] ring-2 ring-inset ring-black/30 dark:bg-[#242424] dark:ring-white/40" : "bg-[#e7e8e5] dark:bg-[#1b1b1b]"}`}
    >
      {/* The whole of a column's chrome pins, not just its name: a task is
          hard to place from a heading alone, and the search that narrows the
          list has to stay reachable while the list is long enough to need it.
          The block spans the column edge to edge and keeps the column's own
          opaque background, so tasks scroll flush into its divider instead of
          showing through it. */}
      <div
        {...boardColumnHeaderProps}
        className={`relative z-10 -mx-2 border-b border-black/10 bg-inherit px-3 pt-1 sm:-mx-3 sm:px-4 dark:border-white/10 ${collapsed ? "pb-1" : "pb-2 sm:pb-3"}`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <i
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <h2 className="shrink-0 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.16em]">
            {status.name}
          </h2>
          <span className="text-xs text-black/40 dark:text-white/40">
            {tasks.length}
          </span>
          <IconButton
            label={`Add task to “${status.name}”`}
            tooltipTriggerClassName="ml-auto"
            onClick={onCreate}
          >
            <FiPlus />
          </IconButton>
          <IconButton
            label={`${collapsed ? "Expand" : "Collapse"} “${status.name}”`}
            aria-expanded={!collapsed}
            aria-controls={`status-column-${status.id}`}
            onClick={onToggle}
          >
            <FiChevronDown
              className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
            />
          </IconButton>
        </div>
        {!collapsed && (
          <>
            <p className="mt-0.5 line-clamp-2 h-8 text-xs leading-snug text-black/60 sm:mt-1 sm:h-10 sm:text-sm dark:text-white/60">
              {status.description}
            </p>
            <div className="mt-3 sm:mt-4">
              <BoardColumnSearch
                statusName={status.name}
                query={query}
                setQuery={setQuery}
                isPending={isPending}
              />
            </div>
          </>
        )}
      </div>
      <AnimatedCollapse
        id={`status-column-${status.id}`}
        open={!collapsed}
        className={collapsed ? "" : "mt-2 sm:mt-3"}
      >
        <BoardColumnTasks
          statusName={status.name}
          tasks={filtered}
          query={query}
          isPending={isPending}
          renderTask={renderTask}
          onCreate={onCreate}
        />
      </AnimatedCollapse>
    </section>
  );
}
