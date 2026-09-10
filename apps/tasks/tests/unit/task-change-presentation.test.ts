import { describe, expect, it } from "vitest";
import {
  describeTaskChanges,
  taskActivityChanges,
  taskChangeSentence,
  type TaskChangeLookups,
} from "@/lib/activity/task-change-presentation";
import type { TaskChange } from "@/lib/activity/task-change-summary";
import type { TaskActivity } from "@/lib/activity/activity-types";

const lookups: TaskChangeLookups = {
  statuses: [
    { id: "todo", name: "To do", color: "#888888" },
    { id: "doing", name: "In progress", color: "#2563eb" },
  ],
  projects: [
    { id: "gala", name: "Summer gala" },
    { id: "winter", name: "Winter gala" },
  ],
  profiles: [
    {
      id: "sam",
      full_name: "Sam Rivera",
      avatar_url: null,
      onboarding_completed: true,
      task_details_open_by_default: true,
      assign_new_tasks_to_self: false,
      editor_surface: "auto",
      calendar_default_view: ["task", "away", "important", "google"],
    },
    {
      id: "alex",
      full_name: "Alex Chen",
      avatar_url: null,
      onboarding_completed: true,
      task_details_open_by_default: true,
      assign_new_tasks_to_self: false,
      editor_surface: "auto",
      calendar_default_view: ["task", "away", "important", "google"],
    },
  ],
  categories: [
    { id: "ops", name: "Operations", color: "#f97316" },
    { id: "events", name: "Events", color: "#2563eb" },
  ],
};

const sentence = (change: TaskChange) =>
  taskChangeSentence(describeTaskChanges([change], lookups)[0]!);

describe("task change presentation", () => {
  it("resolves ids to the names the task editor shows", () => {
    const [status, project] = describeTaskChanges(
      [
        { field: "status", from: "todo", to: "doing" },
        { field: "project", from: null, to: "gala" },
      ],
      lookups,
    );
    expect(status).toMatchObject({ from: "To do", to: "In progress" });
    expect(project).toMatchObject({ from: undefined, to: "Summer gala" });
  });

  it("formats dates, times, and priorities for reading", () => {
    const [due, time, reminder, priority] = describeTaskChanges(
      [
        { field: "due_date", from: null, to: "2026-09-01" },
        { field: "due_time", from: null, to: "14:30" },
        { field: "reminder_at", from: null, to: "2026-09-01T12:00:00.000Z" },
        { field: "priority", from: "medium", to: "urgent" },
      ],
      lookups,
    );
    expect(due.to).toBe("Sep 1, 2026");
    expect(time.to).toBe("2:30 PM");
    expect(reminder.to).toContain("Sep 1, 2026");
    expect(priority).toMatchObject({ from: "Medium", to: "Urgent" });
  });

  it("writes each scalar change as a plain sentence", () => {
    expect(sentence({ field: "status", from: "todo", to: "doing" })).toBe(
      "Changed status from To do to In progress",
    );
    expect(sentence({ field: "priority", from: null, to: "urgent" })).toBe(
      "Set priority to Urgent",
    );
    expect(sentence({ field: "title", from: "Old", to: "Book the hall" })).toBe(
      "Renamed to “Book the hall”",
    );
    expect(sentence({ field: "reported_by", from: "sam", to: "alex" })).toBe(
      "Changed the reporter from Sam Rivera to Alex Chen",
    );
    expect(sentence({ field: "description" })).toBe("Edited the description");
  });

  it("uses the verbs that fit assignment and project moves", () => {
    expect(sentence({ field: "assignee", from: null, to: "sam" })).toBe(
      "Assigned to Sam Rivera",
    );
    expect(sentence({ field: "assignee", from: "sam", to: "alex" })).toBe(
      "Reassigned from Sam Rivera to Alex Chen",
    );
    expect(sentence({ field: "assignee", from: "sam", to: null })).toBe(
      "Unassigned Sam Rivera",
    );
    expect(sentence({ field: "project", from: null, to: "gala" })).toBe(
      "Added to Summer gala",
    );
    expect(sentence({ field: "project", from: "gala", to: "winter" })).toBe(
      "Moved from Summer gala to Winter gala",
    );
    expect(sentence({ field: "project", from: "gala", to: null })).toBe(
      "Removed from Summer gala",
    );
  });

  it("separates a cleared schedule field from a set one", () => {
    expect(sentence({ field: "due_date", from: null, to: "2026-09-01" })).toBe(
      "Set the due date to Sep 1, 2026",
    );
    expect(
      sentence({ field: "due_date", from: "2026-08-01", to: "2026-09-01" }),
    ).toBe("Moved the due date from Aug 1, 2026 to Sep 1, 2026");
    expect(sentence({ field: "due_date", from: "2026-08-01", to: null })).toBe(
      "Cleared the due date",
    );
    expect(
      sentence({
        field: "reminder_at",
        from: null,
        to: "2026-09-01T12:00:00Z",
      }),
    ).toContain("Set a reminder for Sep 1, 2026");
  });

  it("names added and removed categories and tags", () => {
    expect(sentence({ field: "categories", added: ["ops"], removed: [] })).toBe(
      "Added the Operations category",
    );
    expect(
      sentence({ field: "categories", added: ["ops", "events"], removed: [] }),
    ).toBe("Added the Operations and Events categories");
    expect(
      sentence({ field: "categories", added: ["ops"], removed: ["events"] }),
    ).toBe("Added the Operations category and removed the Events category");
    expect(sentence({ field: "tags", added: ["av"], removed: [] })).toBe(
      "Added the av tag",
    );
  });

  it("stays readable when a change points at something deleted", () => {
    // A cleared field and a field pointing at a deleted record both resolve to
    // no name, so the sentence has to tell them apart.
    expect(sentence({ field: "status", from: "todo", to: "deleted" })).toBe(
      "Changed status",
    );
    expect(sentence({ field: "project", from: null, to: "deleted" })).toBe(
      "Changed the project",
    );
    expect(sentence({ field: "assignee", from: null, to: "deleted" })).toBe(
      "Changed the assignee",
    );
  });

  it("reads changes off an activity record and ignores rows without them", () => {
    const item = (details: TaskActivity["details"]): TaskActivity => ({
      id: "activity",
      task_id: "task",
      actor_id: "sam",
      action: "updated the task",
      details,
      created_at: "2026-08-24T13:50:29.856Z",
    });
    expect(
      taskActivityChanges(
        item({ changes: [{ field: "status", from: "todo", to: "doing" }] }),
        lookups,
      ),
    ).toHaveLength(1);
    expect(taskActivityChanges(item({}), lookups)).toEqual([]);
  });
});
