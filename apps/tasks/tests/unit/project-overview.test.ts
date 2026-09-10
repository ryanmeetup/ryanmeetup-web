import { describe, expect, it } from "vitest";
import {
  projectBoardPresetPath,
  projectNeedsAttention,
  projectOverviewMetrics,
  projectProgress,
  projectTeam,
} from "@/lib/resources/project-overview";
import type { Status, Task, TaskAssignee } from "@/lib/tasks/task-types";
import type { Profile } from "@/lib/workspace/workspace-types";

const statuses = [
  {
    id: "todo",
    name: "Todo",
    sort_order: 0,
    outcome: "open",
  },
  {
    id: "doing",
    name: "Doing",
    sort_order: 1,
    outcome: "open",
  },
  {
    id: "done",
    name: "Done",
    sort_order: 2,
    outcome: "delivered",
  },
  {
    id: "declined",
    name: "Will Not Do",
    sort_order: 3,
    outcome: "declined",
  },
] as Status[];

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  task_number: Number(id.replace(/\D/g, "")) || 1,
  title: id,
  description: null,
  status_id: "todo",
  project_id: "project",
  created_by: "owner",
  reported_by: "owner",
  start_date: null,
  due_date: null,
  due_time: null,
  reminder_at: null,
  priority: "medium",
  board_position: 1024,
  completed_at: null,
  archived_at: null,
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
  ...overrides,
});

describe("project overview selectors", () => {
  const today = new Date("2026-09-05T12:00:00Z");

  it("derives open, overdue, upcoming, and completion measures", () => {
    const tasks = [
      task("task-1", { due_date: "2026-09-04" }),
      task("task-2", { due_date: "2026-09-10" }),
      task("task-3", {
        status_id: "done",
        completed_at: "2026-09-02T12:00:00Z",
      }),
    ];
    expect(projectOverviewMetrics(tasks, statuses, today)).toEqual({
      open: 2,
      overdue: 1,
      dueSoon: 1,
      completed: 1,
      declined: 0,
      total: 3,
      completionPercentage: 33,
    });
  });

  it("counts declined work apart from delivered work", () => {
    const tasks = [
      task("task-1"),
      task("task-2", {
        status_id: "done",
        completed_at: "2026-09-02T12:00:00Z",
      }),
      // Declined and overdue: closed work must stop asking for attention.
      task("task-3", {
        status_id: "declined",
        due_date: "2026-08-01",
        completed_at: "2026-09-02T12:00:00Z",
      }),
    ];
    const metrics = projectOverviewMetrics(tasks, statuses, today);

    expect(metrics).toEqual({
      open: 1,
      overdue: 0,
      dueSoon: 0,
      completed: 1,
      declined: 1,
      // A decline was taken off the plan, so it is not left in the denominator
      // holding the bar down the way an unfinished task would.
      total: 2,
      completionPercentage: 50,
    });
    expect(
      projectNeedsAttention(tasks, statuses, [], today).map(
        (item) => item.task.id,
      ),
    ).not.toContain("task-3");
  });

  it("builds readable board links for each project measure", () => {
    // Every "still open" link excludes both endings, while the completed link
    // names only the delivered one.
    expect(projectBoardPresetPath("Website Refresh", statuses, "open")).toBe(
      "/board?project=Website+Refresh&excludeStatuses=Done%2CWill+Not+Do",
    );
    expect(projectBoardPresetPath("Website Refresh", statuses, "overdue")).toBe(
      "/board?project=Website+Refresh&excludeStatuses=Done%2CWill+Not+Do&dueWithin=overdue",
    );
    expect(
      projectBoardPresetPath("Website Refresh", statuses, "due-soon"),
    ).toBe(
      "/board?project=Website+Refresh&excludeStatuses=Done%2CWill+Not+Do&dueWithin=14",
    );
    expect(
      projectBoardPresetPath("Website Refresh", statuses, "complete"),
    ).toBe("/board?project=Website+Refresh&status=Done");
    expect(
      projectBoardPresetPath("Website Refresh", statuses, "declined"),
    ).toBe("/board?project=Website+Refresh&status=Will+Not+Do");
  });

  it("ranks exceptions and leaves future dates to the schedule", () => {
    const tasks = [
      task("task-1", { due_date: "2026-09-03", priority: "low" }),
      task("task-2", { priority: "urgent" }),
      task("task-3", { due_date: "2026-09-05" }),
      task("task-4", { status_id: "done", due_date: "2026-09-01" }),
    ];
    const assignees = [
      { task_id: "task-3", profile_id: "owner" },
    ] as TaskAssignee[];
    expect(
      projectNeedsAttention(tasks, statuses, assignees, today).map(
        ({ task: item, reason }) => [item.id, reason],
      ),
    ).toEqual([
      ["task-1", "Overdue by 2 days"],
      ["task-2", "Urgent and unassigned"],
    ]);
  });

  it("orders non-empty progress groups by status order", () => {
    expect(
      projectProgress(
        [
          task("task-1", { status_id: "done" }),
          task("task-2"),
          task("task-3", { archived_at: "2026-09-04T12:00:00Z" }),
        ],
        statuses,
      ).map(({ status, count }) => [status.id, count]),
    ).toEqual([
      ["todo", 1],
      ["done", 1],
    ]);
  });

  it("lists project owners first, followed by unique task assignees", () => {
    const profiles = ["owner", "teammate", "outsider"].map((id): Profile => ({
      id,
      full_name: id,
      avatar_url: null,
      onboarding_completed: true,
      task_details_open_by_default: false,
      assign_new_tasks_to_self: false,
      editor_surface: "auto",
      calendar_default_view: ["task", "away", "important", "google"],
    }));

    expect(
      projectTeam(
        "project",
        [
          task("task-1"),
          task("task-2"),
          task("other", { project_id: "other" }),
        ],
        [{ project_id: "project", profile_id: "owner" }],
        [
          { task_id: "task-1", profile_id: "teammate" },
          { task_id: "task-2", profile_id: "owner" },
          { task_id: "other", profile_id: "outsider" },
        ],
        profiles,
      ).map(({ profile, isOwner }) => [profile.id, isOwner]),
    ).toEqual([
      ["owner", true],
      ["teammate", false],
    ]);
  });
});
