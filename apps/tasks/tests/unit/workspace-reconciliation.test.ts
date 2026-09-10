import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/workspace/demo-data";
import {
  reconcileTaskEvent,
  taskChildReconcilers,
} from "@/lib/workspace/workspace-reconciliation";
import type { RealtimePayload } from "@/lib/workspace/workspace-state";

const event = (
  eventType: RealtimePayload["eventType"],
  row: Record<string, unknown>,
): RealtimePayload => ({
  eventType,
  new: eventType === "DELETE" ? {} : row,
  old: eventType === "DELETE" ? row : {},
});

describe("workspace realtime reconciliation", () => {
  it("inserts and orders an accessible task", () => {
    const current = structuredClone(demoData);
    const newest = {
      ...current.tasks[0],
      id: "new-task",
      title: "Newest",
      updated_at: "2099-01-01T00:00:00.000Z",
    };
    const result = reconcileTaskEvent(current, event("INSERT", newest));
    expect(result.refreshTasks).toBe(false);
    expect(result.data.tasks[0]).toMatchObject({ id: "new-task" });
  });

  it("merges an update without mutating the previous workspace", () => {
    const current = structuredClone(demoData);
    const task = current.tasks[0];
    const result = reconcileTaskEvent(
      current,
      event("UPDATE", { ...task, title: "Updated title" }),
    );
    expect(result.data.tasks.find((item) => item.id === task.id)?.title).toBe(
      "Updated title",
    );
    expect(current.tasks[0].title).toBe(task.title);
  });

  it("deletes a task using the old realtime row", () => {
    const current = structuredClone(demoData);
    const id = current.tasks[0].id;
    const result = reconcileTaskEvent(current, event("DELETE", { id }));
    expect(result.data.tasks.some((task) => task.id === id)).toBe(false);
  });

  it("ignores child inserts for tasks outside the loaded workspace", () => {
    const current = structuredClone(demoData);
    const result = taskChildReconcilers.subtasks(
      current,
      event("INSERT", {
        id: "hidden-child",
        task_id: "hidden-task",
        title: "Hidden",
        outcome: "open",
        sort_order: 0,
        created_by: current.currentProfile.id,
        created_at: "2099-01-01T00:00:00.000Z",
      }),
    );
    expect(result).toBe(current);
  });

  it("reconciles child insert, update, and delete independently", () => {
    const current = structuredClone(demoData);
    const taskId = current.tasks[0].id;
    const inserted = taskChildReconcilers.subtasks(
      current,
      event("INSERT", {
        id: "child",
        task_id: taskId,
        title: "First",
        outcome: "open",
        sort_order: 2,
        created_by: current.currentProfile.id,
        created_at: "2099-01-01T00:00:00.000Z",
      }),
    );
    const updated = taskChildReconcilers.subtasks(
      inserted,
      event("UPDATE", {
        ...inserted.subtasks.find((item) => item.id === "child"),
        title: "Second",
      }),
    );
    const deleted = taskChildReconcilers.subtasks(
      updated,
      event("DELETE", { id: "child" }),
    );
    expect(updated.subtasks.find((item) => item.id === "child")?.title).toBe(
      "Second",
    );
    expect(deleted.subtasks.some((item) => item.id === "child")).toBe(false);
  });
});
