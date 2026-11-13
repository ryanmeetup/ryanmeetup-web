import { describe, expect, it } from "vitest";
import {
  resolveDueFilterValues,
  resolveEntityFilterIds,
  resolvePriorityFilterValues,
  splitTaskFilterValues,
  readableTaskFilterValue,
} from "@/lib/tasks/task-filter-values";

describe("task filter values", () => {
  it("normalizes empty and all selections", () => {
    expect(splitTaskFilterValues("all")).toEqual([]);
    expect(splitTaskFilterValues("a,b")).toEqual(["a", "b"]);
  });

  it("resolves readable entity names to ids", () => {
    const items = [{ id: "one", name: "Project One" }];
    expect(resolveEntityFilterIds("Project One", items)).toEqual(["one"]);
    expect(resolveEntityFilterIds("none", items, true)).toEqual(["none"]);
  });

  it("uses IDs for ambiguous, reserved, and comma-containing names", () => {
    const items = [
      { id: "one", name: "Duplicate" },
      { id: "two", name: "Duplicate" },
      { id: "three", name: "Work, home" },
      { id: "four", name: "Unassigned" },
      { id: "five", name: "Life improvements" },
    ];
    for (const item of items.slice(0, 4)) {
      expect(
        readableTaskFilterValue(item.id, items, (value) => value.name),
      ).toBe(item.id);
    }
    expect(readableTaskFilterValue("five", items, (value) => value.name)).toBe(
      "Life improvements",
    );
  });

  it("accepts only supported priority and due values", () => {
    expect(resolvePriorityFilterValues("HIGH,nope,urgent")).toEqual([
      "high",
      "urgent",
    ]);
    expect(resolveDueFilterValues("overdue,7,90,30")).toEqual([
      "overdue",
      "7",
      "30",
    ]);
  });
});
