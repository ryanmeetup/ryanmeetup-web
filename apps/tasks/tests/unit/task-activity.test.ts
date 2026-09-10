import { describe, expect, it } from "vitest";
import {
  taskActivityLabel,
  taskStatusChange,
  taskStatusChangesForTasks,
} from "@/lib/activity/task-activity";
import type { Status } from "@/lib/tasks/task-types";
import type { TaskActivity } from "@/lib/activity/activity-types";

const statuses = [
  { id: "todo", name: "To do" },
  { id: "done", name: "Done" },
] as Status[];

describe("task activity", () => {
  it("keeps only status moves for the requested tasks", () => {
    const activity = [
      {
        id: "created",
        task_id: "task",
        actor_id: null,
        action: "created the task",
        details: {},
        created_at: "2026-08-13T00:00:00.000Z",
      },
      {
        id: "move",
        task_id: "task",
        actor_id: null,
        action: "moved task",
        details: { from_status_id: "todo", status_id: "done" },
        created_at: "2026-08-14T00:00:00.000Z",
      },
      {
        id: "other-task-move",
        task_id: "other-task",
        actor_id: null,
        action: "moved task",
        details: { from_status_id: "todo", status_id: "done" },
        created_at: "2026-08-15T00:00:00.000Z",
      },
    ] satisfies TaskActivity[];

    expect(taskStatusChangesForTasks(activity, new Set(["task"]))).toEqual([
      activity[1],
    ]);
  });

  it("resolves status changes from activity details", () => {
    const activity = {
      id: "activity",
      task_id: "task",
      actor_id: null,
      action: "moved task",
      details: { from_status_id: "todo", status_id: "done" },
      created_at: "2026-08-13T00:00:00.000Z",
    } satisfies TaskActivity;
    expect(taskStatusChange(activity, statuses)).toEqual({
      from: statuses[0],
      to: statuses[1],
    });
  });

  it("normalizes common activity labels", () => {
    expect(taskActivityLabel("created the task")).toBe("Task created");
    expect(taskActivityLabel("added checklist item Buy snacks")).toBe(
      "Checklist item added Buy snacks",
    );
    expect(taskActivityLabel("added 8 checklist items")).toBe(
      "8 checklist items added",
    );
    expect(taskActivityLabel("added 1 checklist items")).toBe(
      "1 checklist item added",
    );
    expect(taskActivityLabel("attached brief.pdf")).toBe(
      "Attachment added: brief.pdf",
    );
    expect(taskActivityLabel("changed priority")).toBe("Changed priority");
    expect(taskActivityLabel("organization.create")).toBe("Contact created");
    expect(taskActivityLabel("note.archive")).toBe("Note archived");
    expect(taskActivityLabel("note.comment")).toBe("Comment added to note");
    expect(taskActivityLabel("project.delete")).toBe("Project deleted");
    expect(taskActivityLabel("category.delete")).toBe("Category deleted");
    expect(taskActivityLabel("task.delete")).toBe("Task deleted");
    expect(taskActivityLabel("project.attachment.delete")).toBe(
      "Project attachment removed",
    );
  });

  it("names the actions that used to render as raw machine text", () => {
    expect(taskActivityLabel("project.attachment.update")).toBe(
      "Project attachment edited",
    );
    expect(taskActivityLabel("category.attachment.update")).toBe(
      "Category attachment edited",
    );
    expect(taskActivityLabel("calendar.create")).toBe("Calendar event created");
    expect(taskActivityLabel("note.comment.delete")).toBe(
      "Comment on note deleted",
    );
    expect(taskActivityLabel("organization.person.remove")).toBe(
      "Person removed from contact",
    );
    expect(taskActivityLabel("contact_category.create")).toBe(
      "Contact category created",
    );
    expect(taskActivityLabel("project.owners.update")).toBe(
      "Project owners changed",
    );
    expect(taskActivityLabel("status.reorder")).toBe("Statuses reordered");
    expect(taskActivityLabel("team.invite")).toBe("Teammate invited");
  });
});
