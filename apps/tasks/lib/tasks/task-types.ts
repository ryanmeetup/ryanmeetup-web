import type { StatusOutcome } from "./status-outcome";

export type Priority = "low" | "medium" | "high" | "urgent";

export type Status = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  order_revision: number;
  is_default: boolean;
  /** Whether work here is still open, was delivered, or was declined. */
  outcome: StatusOutcome;
  /** Moving a task into this status requires a reason, kept as a comment. */
  requires_reason: boolean;
};

export type Task = {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  status_id: string;
  project_id: string | null;
  created_by: string;
  reported_by: string;
  start_date: string | null;
  due_date: string | null;
  due_time: string | null;
  reminder_at: string | null;
  priority: Priority;
  category_tags?: Record<string, string[]>;
  board_position: number;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskReference = Pick<Task, "id" | "task_number" | "project_id">;

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  parent_id: string | null;
  body: string;
  created_by: string;
  created_at: string;
  edited_at: string | null;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  name: string;
  url: string;
  file_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string;
  created_at: string;
};

export type Label = {
  id: string;
  name: string;
  color: string;
  created_by: string;
};

export type TaskAssignee = { task_id: string; profile_id: string };
export type TaskLabel = { task_id: string; label_id: string };
export type TaskCategory = { task_id: string; category_id: string };

export type NewTaskDetailsDraft = {
  checklist: { id: string; title: string }[];
  files: File[];
  urls: { id: string; url: string }[];
};
