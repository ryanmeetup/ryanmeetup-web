import type {
  CategoryOwner,
  Project,
  ProjectOwner,
} from "@/lib/resources/resource-types";
import type {
  Subtask,
  Task,
  TaskAssignee,
  TaskAttachment,
  TaskCategory,
  TaskComment,
  TaskLabel,
} from "@/lib/tasks/task-types";
import type { TaskActivity } from "@/lib/activity/activity-types";
import { mergeTaskAttachments } from "@/lib/tasks/task-attachment-state";
import type { WorkspaceData } from "./workspace-types";
import {
  eventRow,
  removeByKey,
  replaceByKey,
  type RealtimePayload,
  type RealtimeRow,
} from "./workspace-state";

type TaskChildField =
  | "subtasks"
  | "comments"
  | "activity"
  | "taskAssignees"
  | "taskLabels"
  | "taskCategories";

export type TaskReconciliation = {
  data: WorkspaceData;
  refreshTasks: boolean;
};

const hasTask = (data: WorkspaceData, taskId: unknown) =>
  typeof taskId === "string" && data.tasks.some((task) => task.id === taskId);

export function reconcileTaskEvent(
  data: WorkspaceData,
  payload: RealtimePayload,
): TaskReconciliation {
  const row = eventRow(payload);
  if (typeof row.id !== "string") return { data, refreshTasks: false };
  if (payload.eventType === "DELETE") {
    return {
      data: {
        ...data,
        tasks: removeByKey(data.tasks, row, (item) => String(item.id)),
      },
      refreshTasks: false,
    };
  }
  const task = row as Task;
  if (
    task.project_id &&
    !data.projects.some((project) => project.id === task.project_id)
  ) {
    return { data, refreshTasks: true };
  }
  return {
    data: {
      ...data,
      tasks: replaceByKey(data.tasks, task, (item) => item.id).sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at),
      ),
    },
    refreshTasks: false,
  };
}

function reconcileTaskChild<T>(
  data: WorkspaceData,
  payload: RealtimePayload,
  field: TaskChildField,
  key: (value: T | RealtimeRow) => string,
  sort?: (a: T, b: T) => number,
): WorkspaceData {
  const row = eventRow(payload);
  const rows = data[field] as T[];
  if (payload.eventType === "DELETE") {
    return { ...data, [field]: removeByKey(rows, row, key) };
  }
  if (!hasTask(data, row.task_id)) return data;
  const next = replaceByKey(rows, row as T, key);
  return { ...data, [field]: sort ? next.sort(sort) : next };
}

export const taskChildReconcilers = {
  subtasks: (data: WorkspaceData, payload: RealtimePayload) =>
    reconcileTaskChild<Subtask>(
      data,
      payload,
      "subtasks",
      (item) => String(item.id),
      (a, b) => a.sort_order - b.sort_order,
    ),
  task_comments: (data: WorkspaceData, payload: RealtimePayload) =>
    reconcileTaskChild<TaskComment>(
      data,
      payload,
      "comments",
      (item) => String(item.id),
      (a, b) => a.created_at.localeCompare(b.created_at),
    ),
  task_activity: (data: WorkspaceData, payload: RealtimePayload) =>
    reconcileTaskChild<TaskActivity>(
      data,
      payload,
      "activity",
      (item) => String(item.id),
      (a, b) => b.created_at.localeCompare(a.created_at),
    ),
  task_assignees: (data: WorkspaceData, payload: RealtimePayload) =>
    reconcileTaskChild<TaskAssignee>(data, payload, "taskAssignees", (item) =>
      `${String(item.task_id)}:${String(item.profile_id)}`,
    ),
  task_labels: (data: WorkspaceData, payload: RealtimePayload) =>
    reconcileTaskChild<TaskLabel>(data, payload, "taskLabels", (item) =>
      `${String(item.task_id)}:${String(item.label_id)}`,
    ),
  task_categories: (data: WorkspaceData, payload: RealtimePayload) =>
    reconcileTaskChild<TaskCategory>(data, payload, "taskCategories", (item) =>
      `${String(item.task_id)}:${String(item.category_id)}`,
    ),
} as const;

export function reconcileAttachmentEvent(
  data: WorkspaceData,
  payload: RealtimePayload,
): WorkspaceData {
  const row = eventRow(payload);
  if (payload.eventType === "DELETE") {
    return {
      ...data,
      attachments: removeByKey(data.attachments, row, (item) => String(item.id)),
    };
  }
  if (!hasTask(data, row.task_id)) return data;
  const attachment = row as TaskAttachment;
  const existing = data.attachments.find((item) => item.id === attachment.id);
  return {
    ...data,
    attachments: mergeTaskAttachments(data.attachments, [
      existing?.file_path === attachment.file_path
        ? { ...attachment, url: existing.url }
        : attachment,
    ]).sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export function reconcileProjectEvent(
  data: WorkspaceData,
  payload: RealtimePayload,
): WorkspaceData {
  const row = eventRow(payload);
  return {
    ...data,
    projects:
      payload.eventType === "DELETE"
        ? removeByKey(data.projects, row, (item) => String(item.id))
        : replaceByKey(data.projects, row as Project, (item) => item.id).sort(
            (a, b) => a.name.localeCompare(b.name),
          ),
  };
}

export function reconcileProjectOwnerEvent(
  data: WorkspaceData,
  payload: RealtimePayload,
): WorkspaceData {
  const row = eventRow(payload);
  const key = (item: ProjectOwner | RealtimeRow) =>
    `${String(item.project_id)}:${String(item.profile_id)}`;
  return {
    ...data,
    projectOwners:
      payload.eventType === "DELETE"
        ? removeByKey(data.projectOwners, row, key)
        : replaceByKey(data.projectOwners, row as ProjectOwner, key),
  };
}

export function reconcileCategoryOwnerEvent(
  data: WorkspaceData,
  payload: RealtimePayload,
): WorkspaceData {
  const row = eventRow(payload);
  const key = (item: CategoryOwner | RealtimeRow) =>
    `${String(item.category_id)}:${String(item.profile_id)}`;
  return {
    ...data,
    categoryOwners:
      payload.eventType === "DELETE"
        ? removeByKey(data.categoryOwners, row, key)
        : replaceByKey(data.categoryOwners, row as CategoryOwner, key),
  };
}
