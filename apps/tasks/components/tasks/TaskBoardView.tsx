"use client";

import { useMemo, type RefObject } from "react";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { TaskBoardCard } from "./TaskBoardCard";
import { BoardColumn } from "./BoardColumn";
import type { TaskBoardDropTarget } from "@/hooks/useTaskBoardDrag";
import { useBoardViewportHeight } from "@/hooks/useBoardViewportHeight";

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
  onExpandStatus,
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
  onExpandStatus: (id: string) => void;
  onCreate: (statusId: string) => void;
  onOpen: (task: Task) => void;
}) {
  useBoardViewportHeight(scrollRef);
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
    // Once scrolled up to the toolbar's outside inset, the board fills the
    // remaining viewport. Its task lists scroll independently, while the
    // page still scrolls to reach the heading and filters above the board.
    <div
      ref={scrollRef}
      data-board-scroller=""
      className="-mx-4 flex h-[calc(100dvh-var(--board-top-inset,6rem))] min-h-80 flex-none flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain px-4 scroll-px-4 sm:-mx-6 sm:gap-4 sm:px-6 sm:scroll-px-6 lg:-mx-8 lg:px-8 lg:scroll-px-8"
    >
      {statuses.map((status) => (
        <BoardColumn
          key={status.id}
          status={status}
          tasks={model.columns.get(status.id) ?? []}
          collapsed={collapsedStatusIds?.has(status.id) ?? false}
          dragActive={drag.state.draggedTaskId !== null}
          isDropTarget={drag.state.dragOverStatusId === status.id}
          onDragEnterColumn={() => drag.enterColumn(status.id)}
          onDragLeaveColumn={() => drag.leaveColumn(status.id)}
          onDropOnColumn={(taskId) => drag.dropOnColumn(taskId, status.id)}
          onToggle={() => onToggleStatus(status.id)}
          onExpand={() => onExpandStatus(status.id)}
          onCreate={() => onCreate(status.id)}
          renderTask={renderTask}
        />
      ))}
    </div>
  );
}
