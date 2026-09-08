import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/api-schema";
import {
  availableCalendarDefaultView,
  calendarDefaultView,
  calendarDefaultViewOptions,
  isCalendarDefaultView,
} from "@/lib/calendar/calendar-view-preference";

const validProfileBody = {
  displayName: "Sam Rivera",
  taskDetailsOpenByDefault: false,
  assignNewTasksToSelf: false,
  editorSurface: "auto",
  calendarDefaultView: "all",
};

describe("calendarDefaultView", () => {
  it("falls back to everything for a missing or unrecognized value", () => {
    expect(calendarDefaultView(undefined)).toBe("all");
    expect(calendarDefaultView("meetings")).toBe("all");
    expect(isCalendarDefaultView("task")).toBe(true);
    expect(isCalendarDefaultView("meetings")).toBe(false);
  });

  it("offers exactly the views the column's check constraint allows", () => {
    expect(calendarDefaultViewOptions.map((option) => option.value)).toEqual([
      "all",
      "task",
      "away",
      "important",
      "google",
    ]);
  });

  it("uses everything when a saved Google-only view is unavailable", () => {
    expect(availableCalendarDefaultView("google", false)).toBe("all");
    expect(availableCalendarDefaultView("google", true)).toBe("google");
    expect(availableCalendarDefaultView("task", false)).toBe("task");
  });
});

describe("profileSchema calendar default", () => {
  it("carries an allowed default through", () => {
    expect(
      profileSchema({ ...validProfileBody, calendarDefaultView: "task" }),
    ).toMatchObject({ calendarDefaultView: "task" });
  });

  it("rejects a default the database would refuse", () => {
    expect(
      profileSchema({ ...validProfileBody, calendarDefaultView: "meetings" }),
    ).toBeNull();
    expect(
      profileSchema({ ...validProfileBody, calendarDefaultView: undefined }),
    ).toBeNull();
  });
});
