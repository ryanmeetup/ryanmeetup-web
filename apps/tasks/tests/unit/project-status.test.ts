import { describe, expect, it } from "vitest";
import {
  filterProjects,
  groupProjectsByStatus,
  isCurrentProject,
  projectClosedAt,
  projectListFilter,
  projectStatusDetails,
  projectStatusOptions,
} from "@/lib/resources/project-status";
import type { ProjectStatus } from "@/lib/resources/resource-types";

describe("project list filters", () => {
  const projects = [
    { name: "Current", status: "active" as const },
    { name: "Complete", status: "complete" as const },
    { name: "Dropped", status: "dropped" as const },
  ];

  it("keeps existing active, completed, and archived links on their views", () => {
    expect(projectListFilter("active")).toBe("current");
    expect(projectListFilter("unexpected")).toBe("current");
    expect(projectListFilter("completed")).toBe("closed");
    expect(projectListFilter("archived")).toBe("closed");
    expect(projectListFilter("closed")).toBe("closed");
  });

  it("splits projects by whether their status closed them", () => {
    expect(projects.map(isCurrentProject)).toEqual([true, false, false]);
    expect(filterProjects(projects, "current").map((item) => item.name)).toEqual([
      "Current",
    ]);
    expect(filterProjects(projects, "closed").map((item) => item.name)).toEqual([
      "Complete",
      "Dropped",
    ]);
    expect(filterProjects(projects, "all")).toHaveLength(3);
  });
});

describe("projectClosedAt", () => {
  const now = new Date("2026-10-23T12:00:00.000Z");
  const closedAt = "2026-10-01T12:00:00.000Z";

  it("stamps the moment an open project closes", () => {
    expect(
      projectClosedAt({ status: "active", closed_at: null }, "complete", now),
    ).toBe(now.toISOString());
    expect(projectClosedAt(null, "dropped", now)).toBe(now.toISOString());
  });

  it("keeps the original close date when a closed project changes outcome", () => {
    expect(
      projectClosedAt({ status: "complete", closed_at: closedAt }, "dropped", now),
    ).toBe(closedAt);
  });

  it("clears the close date when a project reopens", () => {
    expect(
      projectClosedAt({ status: "complete", closed_at: closedAt }, "active", now),
    ).toBeNull();
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
