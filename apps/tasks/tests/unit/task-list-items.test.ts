import { describe, expect, it } from "vitest";
import { groupTasksByClosedMonth } from "@/components/tasks/TaskListItems";

type ListItem = Parameters<typeof groupTasksByClosedMonth>[0][number];

const item = (id: string, completed_at: string): ListItem =>
  ({ task: { id, completed_at } }) as ListItem;

describe("groupTasksByClosedMonth", () => {
  it("keeps every task from a month in one group when another sort interleaves months", () => {
    const groups = groupTasksByClosedMonth([
      item("first", "2026-09-08T12:00:00Z"),
      item("second", "2026-08-17T12:00:00Z"),
      item("third", "2026-09-01T12:00:00Z"),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-09", "2026-08"]);
    expect(groups[0].items.map(({ task }) => task.id)).toEqual([
      "first",
      "third",
    ]);
  });
});
