import { describe, expect, it } from "vitest";
import {
  accessPreviewHref,
  applyAccessPreview,
  calendarEventsForPreview,
  notesForPreview,
  withAccessPreview,
} from "@/lib/access/access-preview";
import type { CalendarEvent } from "@/lib/calendar/calendar-types";
import type { Note } from "@/lib/resources/resource-types";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";

const baseData = {
  currentProfile: { favorite_project_ids: ["hidden"] },
  categories: [{ id: "general" }, { id: "restricted" }],
  projects: [{ id: "visible" }, { id: "hidden" }],
  tasks: [
    { id: "visible-task", project_id: "visible" },
    { id: "hidden-task", project_id: "hidden" },
    { id: "shared-task", project_id: null },
  ],
  subtasks: [{ task_id: "visible-task" }, { task_id: "hidden-task" }],
  comments: [{ task_id: "hidden-task" }],
  activity: [{ task_id: "visible-task" }],
  attachments: [{ task_id: "hidden-task" }],
  taskAssignees: [{ task_id: "visible-task" }],
  taskLabels: [{ task_id: "hidden-task" }],
  taskCategories: [
    { task_id: "visible-task", category_id: "general" },
    { task_id: "hidden-task", category_id: "restricted" },
  ],
  projectOwners: [{ project_id: "visible" }, { project_id: "hidden" }],
  categoryOwners: [{ category_id: "general" }, { category_id: "restricted" }],
} as unknown as WorkspaceData;

describe("access preview", () => {
  it("uses readable group names in preview links", () => {
    expect(accessPreviewHref("Project Leads")).toBe(
      "/?viewAsGroup=Project%20Leads",
    );
  });

  it("filters every task relation to the preview's visible projects", () => {
    const result = applyAccessPreview(
      baseData,
      { kind: "group", subjectId: "group-1", subjectName: "Reviewers" },
      ["visible"],
    );

    expect(result.projects.map(({ id }) => id)).toEqual(["visible"]);
    expect(result.tasks.map(({ id }) => id)).toEqual([
      "visible-task",
      "shared-task",
    ]);
    expect(result.subtasks).toHaveLength(1);
    expect(result.comments).toHaveLength(0);
    expect(result.attachments).toHaveLength(0);
    expect(result.taskLabels).toHaveLength(0);
    expect(result.projectOwners).toHaveLength(1);
  });

  it("replaces an existing preview without dropping unrelated query state", () => {
    expect(
      withAccessPreview("/?viewAsGroup=old&search=launch", {
        kind: "user",
        subjectId: "user 1",
        subjectName: "User One",
      }),
    ).toBe("/?search=launch&viewAsUser=User+One");
  });

  it("keeps group preview navigation readable", () => {
    expect(
      withAccessPreview("/board?view=list", {
        kind: "group",
        subjectId: "group-1",
        subjectName: "Project Leads",
      }),
    ).toBe("/board?view=list&viewAsGroup=Project+Leads");
  });

  it("uses the viewed user's favorites instead of the owner's favorites", () => {
    const result = applyAccessPreview(
      baseData,
      {
        kind: "user",
        subjectId: "user-1",
        subjectName: "User One",
        subjectProfile: {
          id: "user-1",
          full_name: "User One",
          avatar_url: null,
          onboarding_completed: true,
          task_details_open_by_default: false,
          assign_new_tasks_to_self: false,
          editor_surface: "auto",
          calendar_default_view: ["task", "away", "important", "google"],
          favorite_project_ids: ["visible"],
          app_role: "member",
        },
      },
      ["visible"],
    );

    expect(result.currentProfile.favorite_project_ids).toEqual(["visible"]);
    expect(result.currentProfile.id).toBe("user-1");
  });

  it("does not carry personal favorites into a group preview", () => {
    const result = applyAccessPreview(
      baseData,
      { kind: "group", subjectId: "group-1", subjectName: "Reviewers" },
      ["visible"],
    );

    expect(result.currentProfile.favorite_project_ids).toEqual([]);
  });

  it("removes tasks blocked by category access as well as project access", () => {
    const result = applyAccessPreview(
      baseData,
      {
        kind: "user",
        subjectId: "user-1",
        subjectName: "User One",
        accessibleCategoryIds: ["general"],
        inaccessibleTaskIds: ["visible-task"],
      },
      ["visible"],
    );

    expect(result.tasks.map(({ id }) => id)).toEqual(["shared-task"]);
    expect(result.categories.map(({ id }) => id)).toEqual([
      "general",
      "restricted",
    ]);
    expect(result.categoryOwners).toEqual([{ category_id: "general" }]);
    expect(result.taskCategories).toHaveLength(0);
  });
});

const calendarEvent = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
  id: "event-1",
  kind: "important",
  title: "RyanCon venue decision",
  description: null,
  starts_at: "2026-08-24T00:00:00",
  ends_at: "2026-08-24T23:59:00",
  all_day: true,
  recurrence: null,
  project_id: null,
  category_id: null,
  profile_id: null,
  created_by: "ryan",
  created_at: "2026-08-20T12:00:00Z",
  updated_at: "2026-08-20T12:00:00Z",
  ...overrides,
});

describe("calendar events in an access preview", () => {
  const preview = {
    kind: "group" as const,
    subjectId: "group-1",
    subjectName: "Reviewers",
    accessibleCategoryIds: ["general"],
  };
  const events = [
    calendarEvent({ id: "workspace-wide" }),
    calendarEvent({ id: "visible-project", project_id: "visible" }),
    calendarEvent({ id: "hidden-project", project_id: "hidden" }),
    calendarEvent({ id: "open-category", category_id: "general" }),
    calendarEvent({ id: "restricted-category", category_id: "restricted" }),
    calendarEvent({
      id: "time-away",
      kind: "away",
      project_id: "hidden",
      profile_id: "ryan",
    }),
  ];

  it("keeps only the dates the previewed group may read", () => {
    expect(
      calendarEventsForPreview(events, preview, ["visible"]).map(
        ({ id }) => id,
      ),
    ).toEqual([
      "workspace-wide",
      "visible-project",
      "open-category",
      "time-away",
    ]);
  });

  it("keeps every date when the preview resolved no category limits", () => {
    expect(
      calendarEventsForPreview(
        events,
        { kind: "group", subjectId: "group-1", subjectName: "Reviewers" },
        ["visible", "hidden"],
      ).map(({ id }) => id),
    ).toHaveLength(events.length);
  });
});

describe("notes in an access preview", () => {
  const notes = [
    { id: "unfiled", category_id: null },
    { id: "open", category_id: "general" },
    { id: "restricted", category_id: "finance" },
  ] as Note[];

  it("keeps unfiled notes and drops notes in unreachable work groups", () => {
    expect(
      notesForPreview(notes, {
        kind: "group",
        subjectId: "group-1",
        subjectName: "Reviewers",
        accessibleCategoryIds: ["general"],
      }).map(({ id }) => id),
    ).toEqual(["unfiled", "open"]);
  });

  it("keeps every note when the preview resolved no category limits", () => {
    expect(
      notesForPreview(notes, {
        kind: "group",
        subjectId: "group-1",
        subjectName: "Reviewers",
      }),
    ).toHaveLength(notes.length);
  });
});
