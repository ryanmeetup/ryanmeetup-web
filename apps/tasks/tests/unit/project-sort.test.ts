import { describe, expect, it } from "vitest";
import {
  currentFavoriteProjectIds,
  sortFavoriteProjectsFirst,
} from "@/lib/resources/project-sort";
import type { Project } from "@/lib/resources/resource-types";

const projects = ["alpha", "beta", "gamma", "delta"].map(
  (id) => ({ id, status: "active", archived_at: null }) as Project,
);

describe("sortFavoriteProjectsFirst", () => {
  it("puts favorites first and preserves the existing order within each group", () => {
    expect(
      sortFavoriteProjectsFirst(projects, ["gamma", "alpha"]).map(
        (project) => project.id,
      ),
    ).toEqual(["alpha", "gamma", "beta", "delta"]);
  });

  it("does not mutate the original project list", () => {
    sortFavoriteProjectsFirst(projects, ["delta"]);

    expect(projects.map((project) => project.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
      "delta",
    ]);
  });

  it("drops completed and archived projects from effective favorites", () => {
    const lifecycleProjects = [
      projects[0],
      { ...projects[1], status: "complete" as const },
      { ...projects[2], archived_at: "2026-09-18T12:00:00Z" },
    ];

    expect(
      currentFavoriteProjectIds(lifecycleProjects, ["alpha", "beta", "gamma"]),
    ).toEqual(["alpha"]);
    expect(
      sortFavoriteProjectsFirst(lifecycleProjects, ["beta", "gamma"]).map(
        (project) => project.id,
      ),
    ).toEqual(["alpha", "beta", "gamma"]);
  });
});
