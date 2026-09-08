import { describe, expect, it } from "vitest";
import {
  calendarDayGap,
  defaultProjectStartDate,
  formatDaySpan,
  inferredProjectStartDate,
  projectTimeline,
} from "@/lib/resources/project-timeline";

const today = new Date(2026, 8, 8, 10, 0, 0); // 2026-09-08, local

const project = (
  overrides: Partial<{
    created_at: string;
    start_date: string | null;
    due_date: string | null;
    archived_at: string | null;
  }> = {},
) => ({
  created_at: new Date(2026, 5, 1, 9, 0, 0).toISOString(),
  start_date: null,
  due_date: null,
  archived_at: null,
  ...overrides,
});

describe("defaultProjectStartDate", () => {
  it("uses the local calendar day when the project editor opens", () => {
    expect(defaultProjectStartDate(new Date(2026, 8, 8, 23, 30))).toBe(
      "2026-09-08",
    );
  });
});

describe("inferredProjectStartDate", () => {
  it("collapses the creation instant into the reader's calendar day", () => {
    expect(
      inferredProjectStartDate(new Date(2026, 8, 8, 23, 30).toISOString()),
    ).toBe("2026-09-08");
  });

  it("names the date a blank start date falls back to", () => {
    const record = project({
      created_at: new Date(2026, 5, 1, 9, 0).toISOString(),
    });
    expect(inferredProjectStartDate(record.created_at)).toBe(
      projectTimeline(record, today).start.date,
    );
  });
});

describe("calendarDayGap", () => {
  it("counts whole days between calendar dates", () => {
    expect(calendarDayGap("2026-09-01", "2026-09-08")).toBe(7);
    expect(calendarDayGap("2026-09-08", "2026-09-01")).toBe(-7);
  });

  it("counts across a daylight saving change", () => {
    expect(calendarDayGap("2026-03-07", "2026-03-09")).toBe(2);
  });
});

describe("formatDaySpan", () => {
  it("keeps short spans in days", () => {
    expect(formatDaySpan(0)).toBe("less than a day");
    expect(formatDaySpan(1)).toBe("1 day");
    expect(formatDaySpan(13)).toBe("13 days");
  });

  it("moves up to weeks, months, and years", () => {
    expect(formatDaySpan(14)).toBe("2 weeks");
    expect(formatDaySpan(59)).toBe("8 weeks");
    expect(formatDaySpan(60)).toBe("2 months");
    expect(formatDaySpan(200)).toBe("7 months");
    expect(formatDaySpan(365)).toBe("1 year");
    expect(formatDaySpan(430)).toBe("1 year, 2 months");
  });
});

describe("projectTimeline", () => {
  it("falls back to the day the project was added", () => {
    const { start, running } = projectTimeline(project(), today);

    expect(start).toEqual({ date: "2026-06-01", inferred: true });
    expect(running.ended).toBe(false);
    expect(running.days).toBe(99);
  });

  it("prefers a recorded start date over the created date", () => {
    const { start, running } = projectTimeline(
      project({ start_date: "2026-01-15" }),
      today,
    );

    expect(start).toEqual({ date: "2026-01-15", inferred: false });
    expect(running.label).toBe("8 months");
  });

  it("stops the clock at the day the project was archived", () => {
    const { running } = projectTimeline(
      project({
        start_date: "2026-01-15",
        archived_at: new Date(2026, 2, 16, 12, 0, 0).toISOString(),
      }),
      today,
    );

    expect(running).toEqual({ days: 60, label: "2 months", ended: true });
  });

  it("reads no due date as no deadline", () => {
    expect(projectTimeline(project(), today).due).toBeNull();
  });

  it("warns as a due date approaches and passes", () => {
    const due = (date: string) =>
      projectTimeline(project({ due_date: date }), today).due;

    expect(due("2026-12-25")).toMatchObject({
      tone: "neutral",
      label: "in 4 months",
    });
    expect(due("2026-09-18")).toMatchObject({
      tone: "warning",
      label: "in 10 days",
    });
    expect(due("2026-09-08")).toMatchObject({
      tone: "warning",
      label: "Due today",
      daysRemaining: 0,
    });
    expect(due("2026-08-25")).toMatchObject({
      tone: "danger",
      label: "2 weeks overdue",
      daysRemaining: -14,
    });
  });
});
