import type { Dispatch, SetStateAction } from "react";
import type { NewTaskDetailsDraft } from "./task-types";
import type { Subtask, TaskAttachment } from "./task-types";
import type { TaskActivity } from "@/lib/activity/activity-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { attachmentUrlName } from "./task-attachment-urls";
import { mutate } from "@/lib/mutation-client";

export async function persistNewTaskDetails({
  taskId,
  draft,
  demoMode,
  setData,
}: {
  taskId: string;
  draft: NewTaskDetailsDraft;
  demoMode: boolean;
  setData: Dispatch<SetStateAction<WorkspaceData>>;
}) {
  if (demoMode) {
    const createdAt = new Date().toISOString();
    setData((current) => ({
      ...current,
      subtasks: [
        ...current.subtasks,
        ...draft.checklist.map((item, index) => ({
          id: item.id,
          task_id: taskId,
          title: item.title,
          is_completed: item.completed,
          sort_order: index,
          created_by: current.currentProfile.id,
          created_at: createdAt,
        })),
      ],
      attachments: [
        ...current.attachments,
        ...draft.files.map((file) => ({
          id: crypto.randomUUID(),
          task_id: taskId,
          name: file.name,
          url: "#",
          file_path: null,
          mime_type: file.type || null,
          size_bytes: file.size,
          created_by: current.currentProfile.id,
          created_at: createdAt,
        })),
        ...draft.urls.map((item) => ({
          id: item.id,
          task_id: taskId,
          name: attachmentUrlName(item.url),
          url: item.url,
          file_path: null,
          mime_type: null,
          size_bytes: null,
          created_by: current.currentProfile.id,
          created_at: createdAt,
        })),
      ],
    }));
    return 0;
  }

  let failures = 0;
  const subtasks: Subtask[] = [];
  const attachments: TaskAttachment[] = [];
  const activity: TaskActivity[] = [];
  for (let offset = 0; offset < draft.checklist.length; offset += 100) {
    const items = draft.checklist.slice(offset, offset + 100);
    try {
      const result = await mutate<{
        subtasks?: Subtask[];
        activity?: TaskActivity;
      }>("/api/task-details", {
        method: "POST",
        body: JSON.stringify({
          kind: "subtasks",
          taskId,
          items,
          sortOrder: offset,
        }),
      });
      if (!result.subtasks) failures += items.length;
      else {
        subtasks.push(...result.subtasks);
        if (result.activity) activity.push(result.activity);
      }
    } catch {
      failures += items.length;
    }
  }
  for (const file of draft.files) {
    try {
      const formData = new FormData();
      formData.set("taskId", taskId);
      formData.set("file", file);
      const result = await mutate<{
        attachment?: TaskAttachment;
        activity?: TaskActivity;
      }>("/api/task-attachments", {
        method: "POST",
        body: formData,
      });
      if (!result.attachment) failures += 1;
      else {
        attachments.push(result.attachment);
        if (result.activity) activity.push(result.activity);
      }
    } catch {
      failures += 1;
    }
  }
  for (const item of draft.urls) {
    try {
      const result = await mutate<{
        attachment?: TaskAttachment;
        activity?: TaskActivity;
      }>("/api/task-attachments", {
        method: "POST",
        body: JSON.stringify({ taskId, url: item.url }),
      });
      if (!result.attachment) failures += 1;
      else {
        attachments.push(result.attachment);
        if (result.activity) activity.push(result.activity);
      }
    } catch {
      failures += 1;
    }
  }
  setData((current) => ({
    ...current,
    subtasks: [...current.subtasks, ...subtasks],
    attachments: [...current.attachments, ...attachments],
    activity: [...activity, ...current.activity],
  }));
  return failures;
}
