import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/api-schema";
import {
  availableCalendarDefaultView,
  calendarDefaultView,
  calendarSourceOptions,
  isCalendarDefaultView,
} from "@/lib/calendar/calendar-view-preference";

const validProfileBody = {
  displayName: "Sam Rivera",
  taskDetailsOpenByDefault: false,
  assignNewTasksToSelf: false,
  editorSurface: "auto",
  calendarDefaultView: ["task", "away", "important", "google"],
};

describe("calendarDefaultView", () => {
  it("falls back to everything for a missing or unrecognized value", () => {
    expect(calendarDefaultView(undefined)).toEqual([
      "task",
      "away",
      "important",
      "google",
    ]);
    expect(calendarDefaultView("meetings")).toEqual([
      "task",
      "away",
      "important",
      "google",
    ]);
    expect(isCalendarDefaultView(["task", "important"])).toBe(true);
    expect(isCalendarDefaultView([])).toBe(false);
    expect(isCalendarDefaultView(["task", "task"])).toBe(false);
    expect(isCalendarDefaultView("task")).toBe(false);
    expect(isCalendarDefaultView("meetings")).toBe(false);
  });

  it("offers exactly the sources the column's check constraint allows", () => {
    expect(calendarSourceOptions.map((option) => option.value)).toEqual([
      "task",
      "away",
      "important",
      "google",
    ]);
  });

  it("uses everything when a saved Google-only view is unavailable", () => {
    expect(availableCalendarDefaultView(["google"], false)).toEqual([
      "task",
      "away",
      "important",
    ]);
    expect(availableCalendarDefaultView(["google"], true)).toEqual([
      "google",
    ]);
    expect(
      availableCalendarDefaultView(["task", "google"], false),
    ).toEqual(["task"]);
  });
});

describe("profileSchema calendar default", () => {
  it("carries an allowed default through", () => {
    expect(
      profileSchema({
        ...validProfileBody,
        calendarDefaultView: ["task", "away", "important"],
      }),
    ).toMatchObject({ calendarDefaultView: ["task", "away", "important"] });
  });

  it("rejects a default the database would refuse", () => {
    expect(
      profileSchema({
        ...validProfileBody,
        calendarDefaultView: ["meetings"],
      }),
    ).toBeNull();
    expect(
      profileSchema({ ...validProfileBody, calendarDefaultView: [] }),
    ).toBeNull();
    expect(
      profileSchema({ ...validProfileBody, calendarDefaultView: undefined }),
    ).toBeNull();
  });
});
