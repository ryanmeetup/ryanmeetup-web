import { describe, expect, it } from "vitest";
import {
  filterProjects,
  groupProjectsByStatus,
  isCurrentProject,
  projectListFilter,
  projectStatusDetails,
  projectStatusOptions,
} from "@/lib/resources/project-status";
import type { ProjectStatus } from "@/lib/resources/resource-types";

describe("project list filters", () => {
  const projects = [
    { name: "Current", status: "active" as const, archived_at: null },
    { name: "Complete", status: "complete" as const, archived_at: null },
    { name: "Dropped", status: "dropped" as const, archived_at: null },
    {
      name: "Archived",
      status: "complete" as const,
      archived_at: "2026-08-27T12:00:00.000Z",
    },
  ];

  it("keeps existing active and completed links on their views", () => {
    expect(projectListFilter("active")).toBe("current");
    expect(projectListFilter("unexpected")).toBe("current");
    expect(projectListFilter("completed")).toBe("closed");
    expect(projectListFilter("closed")).toBe("closed");
  });

  it("keeps closed projects out of the default view without archiving them", () => {
    expect(projects.map(isCurrentProject)).toEqual([true, false, false, false]);
    expect(filterProjects(projects, "current").map((item) => item.name)).toEqual([
      "Current",
    ]);
    expect(filterProjects(projects, "closed").map((item) => item.name)).toEqual([
      "Complete",
      "Dropped",
    ]);
    expect(filterProjects(projects, "archived").map((item) => item.name)).toEqual([
      "Archived",
    ]);
    expect(filterProjects(projects, "all")).toHaveLength(4);
  });
});

describe("project status accents", () => {
  it("gives every lifecycle state the same color the dropdown shows", () => {
    for (const option of projectStatusOptions) {
      expect(projectStatusDetails(option.value).color).toBe(option.color);
    }
  });

  it("gives the resting state a color too, so no project renders unmarked", () => {
    expect(projectStatusDetails("discovery").color).toBe("#7c3aed");
  });
});

describe("project status grouping", () => {
  const project = (name: string, status: ProjectStatus) => ({ name, status });

  it("leads with the work that wants attention, not the way projects arrive", () => {
    const groups = groupProjectsByStatus([
      project("Ship", "complete"),
      project("Scope", "discovery"),
      project("Build", "active"),
    ]);
    expect(groups.map((group) => group.value)).toEqual([
      "active",
      "discovery",
      "complete",
    ]);
  });

  it("sections every status, in the order the page reads", () => {
    const groups = groupProjectsByStatus(
      projectStatusOptions.map((option) => project(option.label, option.value)),
    );
    expect(groups.map((group) => group.value)).toEqual([
      "active",
      "queued",
      "discovery",
      "paused",
      "complete",
      "dropped",
    ]);
  });

  it("leaves out statuses nothing is in, so the page has no empty headings", () => {
    const groups = groupProjectsByStatus([project("Build", "active")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].projects.map((item) => item.name)).toEqual(["Build"]);
  });

  it("keeps every project in exactly one group", () => {
    const projects = projectStatusOptions.map((option) =>
      project(option.label, option.value),
    );
    const groups = groupProjectsByStatus(projects);
    expect(groups.flatMap((group) => group.projects)).toHaveLength(
      projects.length,
    );
  });
});
