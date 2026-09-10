import { describe, expect, it, vi } from "vitest";
import { mutate } from "@/lib/mutation-client";
import {
  createTaskMutationService,
  type TaskDraft,
} from "@/lib/tasks/task-mutations";
import type { Task } from "@/lib/tasks/task-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

vi.mock("@/lib/mutation-client", () => ({ mutate: vi.fn() }));

describe("task mutations", () => {
  it("keeps a standalone deletion event in demo activity", async () => {
    const task = {
      id: "task-1",
      title: "Chapter request",
      project_id: "project-1",
    } as Task;
    let data = {
      currentProfile: { id: "profile-1" },
      tasks: [task],
      subtasks: [],
      comments: [],
      activity: [
        {
          id: "old-activity",
          task_id: task.id,
          actor_id: "profile-1",
          action: "created the task",
          details: {},
          created_at: "2026-08-20T12:00:00.000Z",
        },
      ],
      attachments: [],
      taskAssignees: [],
      taskLabels: [],
      taskCategories: [],
    } as unknown as WorkspaceData;
    const service = createTaskMutationService({
      demoMode: true,
      getData: () => data,
      setData: (update) => {
        data = typeof update === "function" ? update(data) : update;
      },
    });

    await service.remove(task.id);

    expect(data.tasks).toEqual([]);
    expect(data.activity).toMatchObject([
      {
        task_id: null,
        actor_id: "profile-1",
        action: "task.delete",
        details: {
          resource_id: task.id,
          resource_name: task.title,
          project_id: task.project_id,
        },
      },
    ]);
  });

  it("records the changed fields when a demo save edits a task", async () => {
    const task = {
      id: "task-1",
      title: "Chapter request",
      status_id: "todo",
      project_id: null,
      assignee_ids: [],
      reported_by: "profile-1",
      description: null,
      start_date: null,
      due_date: null,
      due_time: null,
      reminder_at: null,
      priority: "medium",
      category_tags: {},
    } as unknown as Task;
    let data = {
      currentProfile: { id: "profile-1" },
      statuses: [
        { id: "todo", outcome: "open" },
        { id: "doing", outcome: "open" },
      ],
      tasks: [task],
      activity: [],
      taskAssignees: [],
      taskCategories: [{ task_id: task.id, category_id: "events" }],
    } as unknown as WorkspaceData;
    const service = createTaskMutationService({
      demoMode: true,
      getData: () => data,
      setData: (update) => {
        data = typeof update === "function" ? update(data) : update;
      },
    });

    service.applySaved(
      await service.save(
        {
          ...task,
          title: "Chapter request",
          status_id: "doing",
          category_ids: ["events", "ops"],
          category_tags: {},
        } as unknown as TaskDraft,
        task,
      ),
      true,
    );

    // A save that moves the task *and* edits it records both, the way
    // `log_task_change` does: the move row carries the status change, so the
    // edit row lists only the fields it does not already say.
    expect(data.activity).toMatchObject([
      {
        task_id: task.id,
        actor_id: "profile-1",
        action: "moved task",
        details: { from_status_id: "todo", status_id: "doing" },
      },
      {
        task_id: task.id,
        actor_id: "profile-1",
        action: "updated the task",
        details: {
          changes: [{ field: "categories", added: ["ops"], removed: [] }],
        },
      },
    ]);
  });

  it("records a demo move into a declined status as its reason comment", async () => {
    const task = {
      id: "task-1",
      title: "Second stage lighting",
      status_id: "todo",
      board_position: 1024,
    } as unknown as Task;
    let data = {
      currentProfile: { id: "profile-1" },
      statuses: [
        { id: "todo", outcome: "open", requires_reason: false },
        { id: "declined", outcome: "declined", requires_reason: true },
      ],
      tasks: [task],
      comments: [],
    } as unknown as WorkspaceData;
    const service = createTaskMutationService({
      demoMode: true,
      getData: () => data,
      setData: (update) => {
        data = typeof update === "function" ? update(data) : update;
      },
    });

    await service.move(
      task.id,
      "declined",
      undefined,
      "after",
      "  Venue said no.  ",
    );

    expect(data.tasks[0].status_id).toBe("declined");
    expect(data.comments).toMatchObject([
      { task_id: task.id, body: "Venue said no.", created_by: "profile-1" },
    ]);
  });

  it("shows the rows a server-backed move recorded without a reload", async () => {
    const task = {
      id: "task-1",
      status_id: "todo",
      board_position: 1024,
    } as unknown as Task;
    vi.mocked(mutate).mockResolvedValue({
      task: { ...task, status_id: "declined" },
      activity: {
        id: "activity-1",
        task_id: task.id,
        actor_id: "profile-1",
        action: "moved task",
        details: {},
        created_at: "2026-08-31T12:00:00.000Z",
      },
      comment: {
        id: "comment-1",
        task_id: task.id,
        body: "Venue said no.",
        created_by: "profile-1",
      },
    });
    let data = {
      currentProfile: { id: "profile-1" },
      statuses: [
        { id: "todo", outcome: "open", requires_reason: false },
        { id: "declined", outcome: "declined", requires_reason: true },
      ],
      tasks: [task],
      comments: [],
      activity: [],
    } as unknown as WorkspaceData;
    const service = createTaskMutationService({
      demoMode: false,
      getData: () => data,
      setData: (update) => {
        data = typeof update === "function" ? update(data) : update;
      },
    });

    await service.move(
      task.id,
      "declined",
      undefined,
      "after",
      "Venue said no.",
    );

    expect(data.activity).toMatchObject([{ id: "activity-1" }]);
    expect(data.comments).toMatchObject([{ body: "Venue said no." }]);
  });

  it("sends no reason when a card is reordered inside its own column", async () => {
    const task = {
      id: "task-1",
      status_id: "declined",
      board_position: 1024,
    } as unknown as Task;
    vi.mocked(mutate).mockResolvedValue({ task });
    let data = {
      currentProfile: { id: "profile-1" },
      statuses: [
        { id: "declined", outcome: "declined", requires_reason: true },
      ],
      tasks: [task],
      comments: [],
    } as unknown as WorkspaceData;
    const service = createTaskMutationService({
      demoMode: false,
      getData: () => data,
      setData: (update) => {
        data = typeof update === "function" ? update(data) : update;
      },
    });

    await service.move(task.id, "declined");

    expect(
      JSON.parse(vi.mocked(mutate).mock.calls.at(-1)![1]!.body as string),
    ).toMatchObject({ statusReason: null });
  });

  it("keeps the submitted assignee when the save response omits it", async () => {
    const assigneeId = "profile-1";
    const task = {
      id: "task-1",
      title: "Chapter request",
      project_id: "ryanmeetup-project",
    } as Task;
    vi.mocked(mutate).mockResolvedValue({
      task,
      assignees: [],
      categories: [],
    });
    const draft = {
      title: task.title,
      description: null,
      status_id: "status-1",
      project_id: task.project_id,
      assignee_ids: [assigneeId, "profile-2"],
      reported_by: "profile-reporter",
      start_date: null,
      due_date: null,
      due_time: null,
      reminder_at: null,
      priority: "medium",
      category_ids: ["category-1"],
      category_tags: {},
      status_reason: "",
    } satisfies TaskDraft;
    const service = createTaskMutationService({
      demoMode: false,
      getData: () => ({ statuses: [] }) as unknown as WorkspaceData,
      setData: vi.fn(),
    });

    const saved = await service.save(draft, task);

    expect(saved.assignees).toEqual([
      { task_id: task.id, profile_id: assigneeId },
      { task_id: task.id, profile_id: "profile-2" },
    ]);
  });

  it("keeps the submitted categories when the save response omits them", async () => {
    const categoryId = "category-1";
    const task = {
      id: "task-1",
      title: "Chapter request",
      project_id: "ryanmeetup-project",
    } as Task;
    vi.mocked(mutate).mockResolvedValue({
      task,
      assignees: [],
      categories: [],
    });
    const draft = {
      title: task.title,
      description: null,
      status_id: "status-1",
      project_id: task.project_id,
      assignee_ids: [],
      reported_by: "profile-reporter",
      start_date: null,
      due_date: null,
      due_time: null,
      reminder_at: null,
      priority: "medium",
      category_ids: [categoryId],
      category_tags: {},
      status_reason: "",
    } satisfies TaskDraft;
    const service = createTaskMutationService({
      demoMode: false,
      getData: () => ({ statuses: [] }) as unknown as WorkspaceData,
      setData: vi.fn(),
    });

    const saved = await service.save(draft, task);

    expect(saved.categories).toEqual([
      { task_id: task.id, category_id: categoryId },
    ]);
  });
});
