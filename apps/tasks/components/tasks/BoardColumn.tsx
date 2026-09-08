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

export function BoardColumn({
  status,
  tasks,
  collapsed,
  dragActive,
  isDropTarget,
  onDragEnterColumn,
  onDragLeaveColumn,
  onDropOnColumn,
  onToggle,
  onExpand,
  onCreate,
  renderTask,
}: {
  status: WorkspaceData["statuses"][number];
  tasks: Task[];
  collapsed: boolean;
  dragActive: boolean;
  isDropTarget: boolean;
  onDragEnterColumn: () => void;
  onDragLeaveColumn: () => void;
  onDropOnColumn: (taskId: string) => void;
  onToggle: () => void;
  onExpand: () => void;
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
    // A column is as tall as the board and clips to its own corners, so its
    // chrome simply sits above a list that scrolls on its own. Nothing is
    // pinned against the page, which is what lets the chrome hold still while
    // its tasks run flush past the rule beneath it.
    <section
      data-board-column=""
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
      data-collapsed={collapsed ? "" : undefined}
      data-drag-active={dragActive ? "" : undefined}
      className={`w-[min(240px,70vw)] sm:w-[min(320px,calc(100vw-3rem))] ${collapsed && !dragActive ? "self-start" : "self-stretch"} group/column relative flex shrink-0 flex-col overflow-hidden rounded-2xl transition-[background-color,box-shadow] ${isDropTarget ? "bg-[#d9dcd7] ring-2 ring-inset ring-black/30 dark:bg-[#242424] dark:ring-white/40" : "bg-[#e7e8e5] dark:bg-[#1b1b1b]"}`}
    >
      {/* The whole of a column's chrome stays above the list, not just its
          name: a task is hard to place from a heading alone, and the search
          that narrows the list has to stay reachable while the list is long
          enough to need it. The divider spans the column edge to edge and the
          list starts right beneath it — the gutter a task rests against is
          inside the scroller, so it travels with the task and the rule is
          where the clipping happens. */}
      <div data-board-column-header="" className="shrink-0">
        <div className="border-b border-black/10 px-3 pb-2 pt-3 sm:px-4 sm:pb-3 sm:pt-4 dark:border-white/10">
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
          <p className="mt-0.5 line-clamp-2 h-8 text-xs leading-snug text-black/60 sm:mt-1 sm:h-10 sm:text-sm dark:text-white/60">
            {status.description}
          </p>
          <div className="mt-3 sm:mt-4">
            <BoardColumnSearch
              statusName={status.name}
              query={query}
              setQuery={(nextQuery) => {
                setQuery(nextQuery);
                if (collapsed && nextQuery.trim()) onExpand();
              }}
              isPending={isPending}
            />
          </div>
        </div>
      </div>
      <AnimatedCollapse
        id={`status-column-${status.id}`}
        open={!collapsed}
        className={collapsed ? "" : "min-h-0 flex-1"}
        contentClassName={`flex min-h-0 flex-col origin-top transition-transform duration-300 ease-out motion-reduce:transition-none ${collapsed ? "-translate-y-4" : "translate-y-0"}`}
        style={{ transitionDuration: "300ms" }}
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
      {collapsed && dragActive && (
        <div
          className={`mx-3 mb-3 mt-3 flex min-h-40 flex-1 items-center justify-center rounded-xl border border-dashed px-3 text-center text-xs font-semibold transition-colors sm:mx-4 sm:mb-4 ${isDropTarget ? "border-black/35 text-black/70 dark:border-white/40 dark:text-white/75" : "border-black/15 text-black/40 dark:border-white/15 dark:text-white/40"}`}
        >
          {isDropTarget
            ? `Release in ${status.name}`
            : `Drop in ${status.name}`}
        </div>
      )}
    </section>
  );
}
