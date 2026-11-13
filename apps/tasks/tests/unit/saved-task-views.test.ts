import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/workspace/demo-data";
import {
  savedTaskViewCreateSchema,
  savedTaskViewPatchSchema,
} from "@/lib/api-schema";
import {
  applySavedViewParams,
  savedViewSettingsEqual,
  savedViewSummary,
  savedViewUnavailable,
  type SavedTaskViewSettings,
} from "@/lib/tasks/saved-task-views";

function settings(): SavedTaskViewSettings {
  return {
    version: 1,
    view: "board",
    sort: "updated",
    visibility: "active",
    filters: {
      statuses: [],
      excludedStatuses: [],
      projects: [],
      excludedProjects: [],
      assignees: [],
      excludedAssignees: [],
      reporters: [],
      excludedReporters: [],
      categories: [],
      excludedCategories: [],
      priorities: [],
      excludedPriorities: [],
      dueWithin: [],
      excludedDueWithin: [],
      tags: [],
      excludedTags: [],
    },
  };
}

describe("saved task views", () => {
  it("replaces every old filter, search and pagination while retaining unrelated URL state", () => {
    const saved = settings();
    saved.filters.excludedProjects = [demoData.projects[0].id];
    saved.filters.priorities = ["high"];
    saved.view = "list";
    saved.sort = "due";
    const params = applySavedViewParams(
      new URLSearchParams(
        "category=Old&assignee=Someone&excludeStatuses=Done&q=stale&page=4&viewAsGroup=Team&other=keep",
      ),
      { id: "one", name: "Life improvements", settings: saved },
      demoData,
    );
    expect(Object.fromEntries(params)).toEqual({
      viewAsGroup: "Team",
      other: "keep",
      savedView: "Life improvements",
      view: "list",
      sort: "due",
      visibility: "active",
      excludeProjects: demoData.projects[0].name,
      priority: "high",
    });
    expect(saved.filters.excludedProjects).toEqual([demoData.projects[0].id]);
  });

  it("uses current names after a project rename", () => {
    const saved = settings();
    saved.filters.projects = [demoData.projects[0].id];
    const data = {
      ...demoData,
      projects: demoData.projects.map((project, index) =>
        index === 0 ? { ...project, name: "Renamed project" } : project,
      ),
    };
    const params = applySavedViewParams(
      new URLSearchParams(),
      { id: "one", name: "Focus", settings: saved },
      data,
    );
    expect(params.get("project")).toBe("Renamed project");
    expect(savedViewSummary(saved, data)).toContainEqual({
      label: "Include project",
      value: "Renamed project",
    });
  });

  it("refuses to broaden a view when an included or excluded resource disappears", () => {
    for (const key of ["projects", "excludedProjects"] as const) {
      const saved = settings();
      saved.filters[key] = ["missing-project"];
      expect(savedViewUnavailable(saved, demoData)).toBe(true);
      expect(() =>
        applySavedViewParams(
          new URLSearchParams(),
          { id: "one", name: "Focus", settings: saved },
          demoData,
        ),
      ).toThrow("no longer available");
    }
  });

  it("compares filter sets independently of selection order and duplicates", () => {
    const a = settings();
    const b = settings();
    a.filters.priorities = ["high", "low", "high"];
    b.filters.priorities = ["low", "high"];
    expect(savedViewSettingsEqual(a, b)).toBe(true);
    b.view = "list";
    expect(savedViewSettingsEqual(a, b)).toBe(false);
  });

  it("clears a saved view to all tasks without removing preview state", () => {
    expect(
      applySavedViewParams(
        new URLSearchParams(
          "savedView=Focus&project=Website&excludeTags=Old&q=hello&page=3&viewAsUser=Ryan",
        ),
        null,
        demoData,
      ).toString(),
    ).toBe("viewAsUser=Ryan");
  });

  it("falls back to IDs only for ambiguous or unrepresentable names", () => {
    const saved = settings();
    saved.filters.projects = [demoData.projects[0].id];
    const data = {
      ...demoData,
      projects: [{ ...demoData.projects[0], name: "Work, home" }],
    };
    expect(
      applySavedViewParams(
        new URLSearchParams(),
        { id: "one", name: "Focus", settings: saved },
        data,
      ).get("project"),
    ).toBe(demoData.projects[0].id);
  });
});

describe("saved view request schemas", () => {
  it("trims names and normalizes archive layout", () => {
    expect(
      savedTaskViewCreateSchema({
        name: " Focus ",
        settings: { ...settings(), visibility: "archived" },
      }),
    ).toMatchObject({ name: "Focus", settings: { view: "list" } });
  });

  it("rejects unknown fields, invalid filters, versions, names and incomplete settings", () => {
    for (const body of [
      { name: "", settings: settings() },
      { name: "x".repeat(81), settings: settings() },
      { name: "Focus", settings: settings(), profile_id: "someone-else" },
      { name: "Focus", settings: { ...settings(), version: 2 } },
      { name: "Focus", settings: { ...settings(), sort: "arbitrary" } },
      {
        name: "Focus",
        settings: {
          ...settings(),
          filters: { ...settings().filters, priorities: ["unknown"] },
        },
      },
      { name: "Focus", settings: { ...settings(), filters: {} } },
      { name: "Focus", settings: { ...settings(), q: "secret search" } },
    ])
      expect(savedTaskViewCreateSchema(body)).toBeNull();
  });

  it("renames without replacing the stored settings", () => {
    expect(savedTaskViewPatchSchema({ name: " Renamed " })).toEqual({
      name: "Renamed",
    });
    expect(savedTaskViewPatchSchema({})).toBeNull();
    expect(savedTaskViewPatchSchema({ profile_id: "another-user" })).toBeNull();
  });
});
