import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { statusOutcome } from "@/lib/tasks/status-outcome";

export type RealtimeRow = Record<string, unknown>;
export type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: RealtimeRow;
  old: RealtimeRow;
};

export function restoreWorkspace(
  initial: WorkspaceData,
  restored: WorkspaceData,
): WorkspaceData {
  return {
    ...initial,
    ...restored,
    subtasks: restored.subtasks ?? [],
    comments: restored.comments ?? [],
    activity: restored.activity ?? [],
    attachments: restored.attachments ?? [],
    labels: restored.labels ?? [],
    projects: restored.projects ?? [],
    categories: restored.categories ?? initial.categories,
    taskCategories: restored.taskCategories ?? [],
    projectOwners: restored.projectOwners ?? [],
    categoryOwners: restored.categoryOwners ?? [],
    taskAssignees: restored.taskAssignees ?? [],
    taskLabels: restored.taskLabels ?? [],
    statuses: (restored.statuses ?? initial.statuses).map((status) => ({
      ...status,
      outcome: statusOutcome(status.outcome),
    })),
    tasks: restored.tasks.map((task) => ({
      ...task,
      due_time: task.due_time ?? null,
      reminder_at: task.reminder_at ?? null,
      project_id: task.project_id ?? null,
      completed_at: task.completed_at ?? null,
      archived_at: task.archived_at ?? null,
    })),
  };
}

export function replaceByKey<T>(
  rows: T[],
  row: T,
  key: (value: T) => string,
): T[] {
  const rowKey = key(row);
  const index = rows.findIndex((value) => key(value) === rowKey);
  if (index === -1) return [...rows, row];
  const next = [...rows];
  next[index] = { ...rows[index], ...row };
  return next;
}

export function removeByKey<T>(
  rows: T[],
  row: RealtimeRow,
  key: (value: T | RealtimeRow) => string,
) {
  const rowKey = key(row);
  return rows.filter((value) => key(value) !== rowKey);
}

export function eventRow(payload: RealtimePayload) {
  return payload.eventType === "DELETE" ? payload.old : payload.new;
}
