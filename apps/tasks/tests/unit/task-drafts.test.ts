import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasDraftAutosaveContent,
  readTaskDrafts,
  saveTaskDraft,
} from "@/lib/tasks/task-drafts";
import type { TaskDraft } from "@/lib/tasks/task-mutations";

const contextualDraft: TaskDraft = {
  title: "",
  description: "",
  status_id: "todo",
  project_id: "tasks-site",
  assignee_ids: [],
  reported_by: "ryan",
  start_date: null,
  due_date: null,
  due_time: null,
  reminder_at: null,
  priority: "medium",
  category_ids: ["engineering"],
  category_tags: {},
  status_reason: "",
};

describe("hasDraftAutosaveContent", () => {
  it("ignores values supplied by the surrounding task context", () => {
    expect(hasDraftAutosaveContent(contextualDraft)).toBe(false);
  });

  it("recognizes user-authored task content", () => {
    expect(
      hasDraftAutosaveContent({
        ...contextualDraft,
        title: "Fix the task modal",
      }),
    ).toBe(true);
    expect(
      hasDraftAutosaveContent({
        ...contextualDraft,
        due_date: "2026-08-10",
      }),
    ).toBe(true);
  });

  it("recognizes checklist content in task details", () => {
    expect(
      hasDraftAutosaveContent(contextualDraft, {
        checklist: [{ id: "person-1", title: "Jamie", completed: false }],
        files: [],
        urls: [],
      }),
    ).toBe(true);
  });
});

describe("saved task details", () => {
  const values = new Map<string, string>();

  afterEach(() => {
    vi.unstubAllGlobals();
    values.clear();
  });

  it("round trips checklists and links", () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    vi.stubGlobal("CustomEvent", class CustomEvent {});

    saveTaskDraft(
      "ryan",
      { ...contextualDraft, title: "Prepare 1099s" },
      "draft-1099",
      {
        checklist: [
          { id: "person-1", title: "Jamie", completed: true },
          { id: "person-2", title: "Morgan", completed: false },
        ],
        files: [],
        urls: [{ id: "tax-guide", url: "https://www.irs.gov/1099" }],
      },
    );

    expect(readTaskDrafts("ryan")).toEqual([
      expect.objectContaining({
        id: "draft-1099",
        details: {
          checklist: [
            { id: "person-1", title: "Jamie", completed: true },
            { id: "person-2", title: "Morgan", completed: false },
          ],
          files: [],
          urls: [{ id: "tax-guide", url: "https://www.irs.gov/1099" }],
        },
      }),
    ]);
  });

  it("opens older drafts with empty task details", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          {
            id: "legacy-draft",
            draft: contextualDraft,
            updatedAt: "2026-09-03T12:00:00.000Z",
          },
        ]),
    });
    vi.stubGlobal("window", {});

    expect(readTaskDrafts("ryan")[0]?.details).toEqual({
      checklist: [],
      files: [],
      urls: [],
    });
  });

  it("opens older checklist drafts with their items unchecked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          {
            id: "legacy-checklist",
            draft: contextualDraft,
            details: {
              checklist: [{ id: "person-1", title: "Jamie" }],
              files: [],
              urls: [],
            },
            updatedAt: "2026-09-03T12:00:00.000Z",
          },
        ]),
    });
    vi.stubGlobal("window", {});

    expect(readTaskDrafts("ryan")[0]?.details?.checklist).toEqual([
      { id: "person-1", title: "Jamie", completed: false },
    ]);
  });

  it("drops comments stored by the former create-task UI", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          {
            id: "draft-with-comment",
            draft: contextualDraft,
            details: {
              checklist: [],
              files: [],
              urls: [],
              comment: "Do not post this invisibly.",
            },
            updatedAt: "2026-09-03T12:00:00.000Z",
          },
        ]),
    });
    vi.stubGlobal("window", {});

    expect(readTaskDrafts("ryan")[0]?.details).toEqual({
      checklist: [],
      files: [],
      urls: [],
    });
  });
});
