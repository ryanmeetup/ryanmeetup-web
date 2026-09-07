"use client";

import { useMemo, type RefObject } from "react";
import { AnimatedCollapse, IconButton } from "@ryanmeetup/ui";
import { FiChevronDown, FiPlus } from "react-icons/fi";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { TaskBoardCard } from "./TaskBoardCard";
import { BoardColumnTasks } from "./BoardColumnTasks";
import type { TaskBoardDropTarget } from "@/hooks/useTaskBoardDrag";
import {
  boardColumnHeaderProps,
  boardColumnProps,
  useBoardStickyHeaders,
} from "@/hooks/useBoardStickyHeaders";

function indexByTask<T extends { task_id: string }>(rows: T[]) {
  const index = new Map<string, T[]>();
  for (const row of rows)
    index.set(row.task_id, [...(index.get(row.task_id) ?? []), row]);
  return index;
}

export function TaskBoardView({
  data,
  tasks,
  statuses,
  collapsedStatusIds,
  scrollRef,
  drag,
  onToggleStatus,
  onCreate,
  onOpen,
}: {
  data: WorkspaceData;
  tasks: Task[];
  statuses: WorkspaceData["statuses"];
  collapsedStatusIds: Set<string> | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  drag: {
    state: {
      draggedTaskId: string | null;
      dragOverStatusId: string | null;
      dropTarget: TaskBoardDropTarget | null;
    };
    start: (id: string | null) => void;
    enterColumn: (id: string | null) => void;
    leaveColumn: (id: string) => void;
    overTask: (task: Task, edge: "before" | "after") => void;
    dropOnTask: (task: Task, id: string, edge: "before" | "after") => void;
    dropOnColumn: (id: string, statusId: string) => void;
    cleanup: () => void;
  };
  onToggleStatus: (id: string) => void;
  onCreate: (statusId: string) => void;
  onOpen: (task: Task) => void;
}) {
  const model = useMemo(() => {
    const profiles = new Map(data.profiles.map((item) => [item.id, item]));
    const categories = new Map(data.categories.map((item) => [item.id, item]));
    const projects = new Map(data.projects.map((item) => [item.id, item]));
    const statusIndex = new Map(statuses.map((item) => [item.id, item]));
    const assignees = indexByTask(data.taskAssignees);
    const categoryRows = indexByTask(data.taskCategories);
    const subtasks = indexByTask(data.subtasks);
    const cards = new Map(
      tasks.map((task) => [
        task.id,
        {
          task,
          status: statusIndex.get(task.status_id),
          project: task.project_id
            ? (projects.get(task.project_id) ?? null)
            : null,
          people: (assignees.get(task.id) ?? []).flatMap(
            (row) => profiles.get(row.profile_id) ?? [],
          ),
          categories: (categoryRows.get(task.id) ?? []).flatMap(
            (row) => categories.get(row.category_id) ?? [],
          ),
          subtasks: subtasks.get(task.id) ?? [],
        },
      ]),
    );
    const columns = new Map(
      statuses.map((status) => [
        status.id,
        tasks.filter((task) => task.status_id === status.id),
      ]),
    );
    return { cards, columns };
  }, [
    data.categories,
    data.profiles,
    data.projects,
    data.subtasks,
    data.taskAssignees,
    data.taskCategories,
    statuses,
    tasks,
  ]);

  useBoardStickyHeaders(scrollRef);

  const renderTask = (task: Task) => {
    const card = model.cards.get(task.id)!;
    return (
      <TaskBoardCard
        key={task.id}
        {...card}
        draggedTaskId={drag.state.draggedTaskId}
        dropTarget={drag.state.dropTarget}
        onDragStart={drag.start}
        onDragOver={drag.overTask}
        onDrop={drag.dropOnTask}
        onDragEnd={drag.cleanup}
        onOpen={onOpen}
      />
    );
  };

  return (
    <div
      ref={scrollRef}
      className="-mx-4 flex min-h-[28rem] flex-1 flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain px-4 scroll-px-4 sm:-mx-6 sm:gap-4 sm:px-6 sm:scroll-px-6 lg:-mx-8 lg:px-8 lg:scroll-px-8"
    >
      {statuses.map((status) => {
        const columnTasks = model.columns.get(status.id) ?? [];
        const collapsed = collapsedStatusIds?.has(status.id) ?? false;
        return (
          <section
            key={status.id}
            {...boardColumnProps}
            onDragEnter={(event) => {
              event.preventDefault();
              drag.enterColumn(status.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget;
              if (
                !(next instanceof Node) ||
                !event.currentTarget.contains(next)
              )
                drag.leaveColumn(status.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              drag.dropOnColumn(
                event.dataTransfer.getData("text/task-id"),
                status.id,
              );
            }}
            className={`${collapsed ? "w-[168px] self-start sm:w-[240px]" : "w-[min(240px,70vw)] sm:w-[min(320px,calc(100vw-3rem))]"} group/column relative mb-6 shrink-0 rounded-2xl p-2 transition-[width,background-color,box-shadow] sm:p-3 ${drag.state.dragOverStatusId === status.id ? "bg-[#d9dcd7] ring-2 ring-inset ring-black/30 dark:bg-[#242424] dark:ring-white/40" : "bg-[#e7e8e5] dark:bg-[#1b1b1b]"}`}
          >
            <div
              {...boardColumnHeaderProps}
              className="relative z-10 -mx-1 flex items-center gap-1.5 rounded-lg bg-inherit px-2 py-1 ring-0 ring-inset ring-black/10 transition-shadow group-data-stuck/column:shadow-lg group-data-stuck/column:ring-1 sm:gap-2 dark:ring-white/15"
            >
              <i
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <h2 className="shrink-0 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.16em]">
                {status.name}
              </h2>
              <span className="text-xs text-black/40 dark:text-white/40">
                {columnTasks.length}
              </span>
              <IconButton
                label={`Add task to “${status.name}”`}
                tooltipTriggerClassName="ml-auto"
                onClick={() => onCreate(status.id)}
              >
                <FiPlus />
              </IconButton>
              <IconButton
                label={`${collapsed ? "Expand" : "Collapse"} “${status.name}”`}
                aria-expanded={!collapsed}
                aria-controls={`status-column-${status.id}`}
                onClick={() => onToggleStatus(status.id)}
              >
                <FiChevronDown
                  className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
                />
              </IconButton>
            </div>
            {!collapsed && (
              <p className="mt-0.5 line-clamp-2 h-8 px-1 text-xs leading-snug text-black/60 sm:mt-1 sm:h-10 sm:text-sm dark:text-white/60">
                {status.description}
              </p>
            )}
            <AnimatedCollapse
              id={`status-column-${status.id}`}
              open={!collapsed}
              className={collapsed ? "" : "mt-2 sm:mt-3"}
            >
              <BoardColumnTasks
                statusId={status.id}
                statusName={status.name}
                tasks={columnTasks}
                renderTask={renderTask}
                onCreate={() => onCreate(status.id)}
              />
            </AnimatedCollapse>
          </section>
        );
      })}
    </div>
  );
}
