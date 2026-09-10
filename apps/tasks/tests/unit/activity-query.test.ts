import { describe, expect, it } from "vitest";
import {
  activityFilterCount,
  buildActivityQuery,
} from "@/lib/activity/activity-query";
import type { Project } from "@/lib/resources/resource-types";
import type { Status } from "@/lib/tasks/task-types";
import type { Profile } from "@/lib/workspace/workspace-types";

describe("activity query controller", () => {
  const projects = [{ id: "p1", name: "Meetup" }] as Project[];
  const profiles = [{ id: "u1", full_name: "Ryan Le" }] as Profile[];
  const statuses = [
    { id: "s1", name: "Todo", outcome: "open" },
    { id: "s2", name: "Done", outcome: "delivered" },
    { id: "s3", name: "Shipped", outcome: "delivered" },
  ] as Status[];
  const filters = {
    projects: "Meetup",
    excludeProjects: "",
    people: "Ryan Le",
    excludePeople: "",
    events: "created,moved",
    excludeEvents: "",
    moves: "",
    excludeMoves: "",
    when: "week",
  };
  it("counts every active selection", () =>
    expect(
      activityFilterCount({ ...filters, moves: "to:Done", excludeMoves: "" }),
    ).toBe(6));
  it("resolves readable values at the API boundary", () =>
    expect(
      buildActivityQuery(filters, projects, profiles, statuses).toString(),
    ).toBe("projects=p1&people=u1&events=created%2Cmoved&when=week"));
  it("resolves a named status to its id, keeping the direction", () =>
    expect(
      buildActivityQuery(
        { ...filters, moves: "to:Done,from:Todo" },
        projects,
        profiles,
        statuses,
      ).get("moves"),
    ).toBe("to:s2,from:s1"));
  it("expands the done sentinel across every completed status", () =>
    expect(
      buildActivityQuery(
        { ...filters, moves: "to:completed" },
        projects,
        profiles,
        statuses,
      ).get("moves"),
    ).toBe("to:s2,to:s3"));
  it("does not widen the filter when no status is marked completed", () =>
    expect(
      buildActivityQuery(
        { ...filters, moves: "to:completed" },
        projects,
        profiles,
        [statuses[0]],
      ).get("moves"),
    ).toBe("to:completed"));
  it("collapses a status picked both by name and through the sentinel", () =>
    expect(
      buildActivityQuery(
        { ...filters, moves: "to:completed,to:Done" },
        projects,
        profiles,
        statuses,
      ).get("moves"),
    ).toBe("to:s2,to:s3"));
});
