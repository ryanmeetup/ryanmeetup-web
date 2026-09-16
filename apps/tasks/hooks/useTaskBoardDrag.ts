"use client";

import { useCallback, useState } from "react";
import type { Task } from "@/lib/tasks/task-types";

export type TaskBoardDropTarget = {
  taskId: string;
  edge: "before" | "after";
};

export function useTaskBoardDrag(
  moveTask: (
    id: string,
    statusId: string,
    targetId?: string,
    edge?: "before" | "after",
  ) => void | Promise<void>,
) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatusId, setDragOverStatusId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskBoardDropTarget | null>(
    null,
  );

  const cleanup = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverStatusId(null);
    setDropTarget(null);
  }, []);

  return {
    state: { draggedTaskId, dragOverStatusId, dropTarget },
    start: setDraggedTaskId,
    enterColumn(statusId: string | null) {
      setDragOverStatusId(statusId);
      setDropTarget(null);
    },
    leaveColumn(statusId: string) {
      setDragOverStatusId((current) => (current === statusId ? null : current));
    },
    overTask(task: Task, edge: "before" | "after") {
      setDragOverStatusId(task.status_id);
      setDropTarget({ taskId: task.id, edge });
    },
    dropOnTask(task: Task, id: string, edge: "before" | "after") {
      cleanup();
      void moveTask(id, task.status_id, task.id, edge);
    },
    dropOnColumn(id: string, statusId: string) {
      cleanup();
      void moveTask(id, statusId);
    },
    cleanup,
  };
}
