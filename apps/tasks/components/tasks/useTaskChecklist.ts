"use client";

import { useState } from "react";
import { toast } from "@ryanmeetup/ui";
import {
  createSubtask,
  createSubtasks,
  deleteSubtask,
  renameSubtask,
  setSubtaskCompleted,
} from "@/lib/tasks/task-detail-mutations";
import {
  MAX_CHECKLIST_PASTE_ITEMS,
  type ChecklistPasteItem,
} from "@/lib/tasks/checklist-paste";
import { useWorkspaceWrite } from "@/hooks/useWorkspaceWrite";
import { withRecordedRows } from "@/lib/activity/activity-state";
import type { Subtask } from "@/lib/tasks/task-types";
import type { TaskDetailContext } from "./task-detail-context";

/** Checklist state and writes for one task. */
export function useTaskChecklist({
  task,
  data,
  demoMode,
  setData,
  recordActivity,
}: TaskDetailContext) {
  const write = useWorkspaceWrite(setData);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const items = data.subtasks.filter((item) => item.task_id === task.id);

  async function add() {
    const title = newItemTitle.trim();
    if (!title) return;
    const item: Subtask = {
      id: crypto.randomUUID(),
      task_id: task.id,
      title,
      is_completed: false,
      sort_order: items.length,
      created_by: data.currentProfile.id,
      created_at: new Date().toISOString(),
    };
    setNewItemTitle("");

    if (demoMode) {
      setData((current) => ({
        ...current,
        subtasks: [...current.subtasks, item],
      }));
      await recordActivity(`added checklist item “${title}”`);
      return;
    }

    setSaving(true);
    await write({
      apply: (current) => ({
        ...current,
        subtasks: [...current.subtasks, item],
      }),
      revert: (current) => ({
        ...current,
        subtasks: current.subtasks.filter((entry) => entry.id !== item.id),
      }),
      persist: () =>
        createSubtask({
          taskId: task.id,
          title,
          sortOrder: item.sort_order,
        }),
      reconcile:
        ({ subtask, activity }) =>
        (current) =>
          withRecordedRows(
            { activity },
            {
              ...current,
              subtasks: current.subtasks.map((entry) =>
                entry.id === item.id ? subtask : entry,
              ),
            },
          ),
      whenFailed: "The checklist item could not be added.",
      onFailed: () => setNewItemTitle(title),
    });
    setSaving(false);
  }

  /** Commits a pasted list as one batch, keeping the order it was written in. */
  async function addPasted(pasted: ChecklistPasteItem[]) {
    if (!pasted.length) return;
    if (pasted.length > MAX_CHECKLIST_PASTE_ITEMS) {
      toast.error(
        `Paste up to ${MAX_CHECKLIST_PASTE_ITEMS} checklist items at a time.`,
      );
      return;
    }
    const sortOrder = items.length;
    const created: Subtask[] = pasted.map((entry, index) => ({
      id: crypto.randomUUID(),
      task_id: task.id,
      title: entry.title,
      is_completed: entry.completed,
      sort_order: sortOrder + index,
      created_by: data.currentProfile.id,
      created_at: new Date().toISOString(),
    }));
    const withoutCreated = (subtasks: Subtask[]) =>
      subtasks.filter((entry) => !created.some((item) => item.id === entry.id));

    if (demoMode) {
      setData((current) => ({
        ...current,
        subtasks: [...current.subtasks, ...created],
      }));
      await recordActivity(`added ${created.length} checklist items`);
      return;
    }

    setSaving(true);
    await write({
      apply: (current) => ({
        ...current,
        subtasks: [...current.subtasks, ...created],
      }),
      revert: (current) => ({
        ...current,
        subtasks: withoutCreated(current.subtasks),
      }),
      persist: () =>
        createSubtasks({
          taskId: task.id,
          items: created.map((entry) => ({
            id: entry.id,
            title: entry.title,
            completed: entry.is_completed,
          })),
          sortOrder,
        }),
      reconcile:
        ({ subtasks, activity }) =>
        (current) =>
          withRecordedRows(
            { activity },
            {
              ...current,
              subtasks: [...withoutCreated(current.subtasks), ...subtasks],
            },
          ),
      whenFailed: "The checklist items could not be added.",
    });
    setSaving(false);
  }

  async function toggle(item: Subtask) {
    const completed = !item.is_completed;
    await write({
      apply: (current) => ({
        ...current,
        subtasks: current.subtasks.map((entry) =>
          entry.id === item.id ? { ...entry, is_completed: completed } : entry,
        ),
      }),
      revert: (current) => ({
        ...current,
        subtasks: current.subtasks.map((entry) =>
          entry.id === item.id ? item : entry,
        ),
      }),
      persist: demoMode
        ? undefined
        : () => setSubtaskCompleted(item.id, completed),
      reconcile:
        ({ subtask, activity }) =>
        (current) =>
          withRecordedRows(
            { activity },
            {
              ...current,
              subtasks: current.subtasks.map((entry) =>
                entry.id === item.id ? subtask : entry,
              ),
            },
          ),
      whenFailed: "The checklist item could not be updated.",
    });
    // Demo mode has no request to write the audit row, so the hook writes its
    // own -- matching `add`, which already did, and the strings the API uses.
    if (demoMode)
      await recordActivity(
        completed ? "completed a checklist item" : "reopened a checklist item",
      );
  }

  /** Resolves true once the new title is saved, so the row can close its editor. */
  async function rename(item: Subtask, value: string) {
    const title = value.trim();
    if (!title) return false;
    if (title === item.title) return true;
    const saved = await write({
      apply: (current) => ({
        ...current,
        subtasks: current.subtasks.map((entry) =>
          entry.id === item.id ? { ...entry, title } : entry,
        ),
      }),
      revert: (current) => ({
        ...current,
        subtasks: current.subtasks.map((entry) =>
          entry.id === item.id ? item : entry,
        ),
      }),
      persist: demoMode ? undefined : () => renameSubtask(item.id, title),
      reconcile:
        ({ subtask, activity }) =>
        (current) =>
          withRecordedRows(
            { activity },
            {
              ...current,
              subtasks: current.subtasks.map((entry) =>
                entry.id === item.id ? subtask : entry,
              ),
            },
          ),
      whenFailed: "The checklist item could not be renamed.",
    });
    if (demoMode) await recordActivity("renamed a checklist item");
    return saved;
  }

  async function remove(item: Subtask) {
    await write({
      apply: (current) => ({
        ...current,
        subtasks: current.subtasks.filter((entry) => entry.id !== item.id),
      }),
      revert: (current) => ({
        ...current,
        subtasks: [...current.subtasks, item],
      }),
      persist: demoMode ? undefined : () => deleteSubtask(item.id),
      reconcile:
        ({ activity }) =>
        (current) =>
          withRecordedRows({ activity }, current),
      whenFailed: "The checklist item could not be removed.",
    });
    if (demoMode) await recordActivity("deleted a checklist item");
  }

  return {
    items,
    newItemTitle,
    setNewItemTitle,
    saving,
    add,
    addPasted,
    toggle,
    rename,
    remove,
  };
}
