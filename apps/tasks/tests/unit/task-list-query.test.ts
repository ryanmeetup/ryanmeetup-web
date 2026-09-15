import { describe, expect, it } from "vitest";
import {
  parseTaskListQuery,
  resolveAssigneeTaskFilters,
} from "@/lib/server/tasks/list-query";

const alex = "11111111-1111-4111-8111-111111111111";
const ryan = "22222222-2222-4222-8222-222222222222";

describe("task list assignee filters", () => {
  it("parses several assignees and the unassigned choice", () => {
    const parsed = parseTaskListQuery(
      new URLSearchParams({
        assignee: `${alex},unassigned`,
        excludeAssignees: ryan,
      }),
    );
    expect(parsed).toMatchObject({
      includedAssigneeIds: [alex],
      excludedAssigneeIds: [ryan],
      includeUnassigned: true,
      excludeUnassigned: false,
    });
  });

  it("keeps a task when any of its assignees matches", () => {
    const resolved = resolveAssigneeTaskFilters(
      [
        { task_id: "shared", profile_id: alex },
        { task_id: "shared", profile_id: ryan },
        { task_id: "ryan-only", profile_id: ryan },
      ],
      [alex],
      [ryan],
    );
    expect(resolved.includedAssigneeTaskIds).toEqual(["shared"]);
    expect(resolved.excludedAssigneeTaskIds).toEqual([
      "shared",
      "ryan-only",
    ]);
    expect(resolved.assignedWithoutIncludedAssignee).toEqual(["ryan-only"]);
  });
});

describe("task list sorting", () => {
  it("accepts oldest-first closing dates for the archived list", () => {
    const parsed = parseTaskListQuery(
      new URLSearchParams({ visibility: "archived", sort: "closed-asc" }),
    );
    expect(parsed.sort).toBe("closed-asc");
  });
});
