import { describe, expect, it } from "vitest";
import {
  activityStatusMove,
  matchesExcludedMoves,
  matchesIncludedMoves,
  parseMoveFilter,
} from "@/lib/activity/activity-moves";
import type { TaskActivity } from "@/lib/activity/activity-types";

describe("activity status moves", () => {
  const move = (from: string | null, to: string | null) =>
    activityStatusMove({
      action: "moved task",
      details: { from_status_id: from, status_id: to },
    } as unknown as TaskActivity);
  const todoToDone = move("s1", "s2");
  const backlogToTodo = move("s0", "s1");

  it("reads both status ids off a move", () =>
    expect(todoToDone).toEqual({ from: "s1", to: "s2" }));
  it("leaves every other event without a move", () =>
    expect(
      activityStatusMove({
        action: "updated the task",
        details: { status_id: "s2" },
      } as unknown as TaskActivity),
    ).toBeNull());
  it("ignores an entry with no direction", () =>
    expect(parseMoveFilter(["s2", "to:", "to:s2"])).toEqual({
      to: ["s2"],
      from: [],
    }));

  it("keeps every event while nothing is picked", () =>
    expect(matchesIncludedMoves(null, parseMoveFilter([]))).toBe(true));
  it("narrows to moves once a status is picked", () =>
    expect(matchesIncludedMoves(null, parseMoveFilter(["to:s2"]))).toBe(false));
  it("matches everything that landed in the status", () => {
    const filter = parseMoveFilter(["to:s2"]);
    expect(matchesIncludedMoves(todoToDone, filter)).toBe(true);
    expect(matchesIncludedMoves(backlogToTodo, filter)).toBe(false);
  });
  it("reads the two directions as one transition", () => {
    const filter = parseMoveFilter(["to:s2", "from:s1"]);
    expect(matchesIncludedMoves(todoToDone, filter)).toBe(true);
    expect(matchesIncludedMoves(move("s0", "s2"), filter)).toBe(false);
  });
  it("reads two entries in one direction as alternatives", () => {
    const filter = parseMoveFilter(["to:s1", "to:s2"]);
    expect(matchesIncludedMoves(todoToDone, filter)).toBe(true);
    expect(matchesIncludedMoves(backlogToTodo, filter)).toBe(true);
  });
  it("cannot match a move that recorded no origin", () =>
    expect(
      matchesIncludedMoves(move(null, "s2"), parseMoveFilter(["from:s1"])),
    ).toBe(false));

  it("drops a move matching any excluded direction", () => {
    expect(matchesExcludedMoves(todoToDone, parseMoveFilter(["to:s2"]))).toBe(
      true,
    );
    expect(matchesExcludedMoves(todoToDone, parseMoveFilter(["from:s1"]))).toBe(
      true,
    );
    expect(matchesExcludedMoves(todoToDone, parseMoveFilter(["to:s1"]))).toBe(
      false,
    );
  });
  it("never drops an event that is not a move", () =>
    expect(matchesExcludedMoves(null, parseMoveFilter(["to:s2"]))).toBe(false));
});
