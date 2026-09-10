import { describe, expect, it } from "vitest";
import {
  calendarItems,
  workspaceTimeZoneLabel,
  itemsOnDate,
  monthBounds,
  type CalendarEvent,
} from "@/lib/calendar/calendar-types";
import type { Task } from "@/lib/tasks/task-types";
import type { Project } from "@/lib/resources/resource-types";
import { calendarEventSchema } from "@/lib/api-schema/calendar";
import { workspaceGoogleEventId } from "@/lib/calendar/google-calendar-sync";

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  task_number: 12,
  title: "Book the venue",
  description: null,
  status_id: "todo",
  project_id: null,
  created_by: "ryan",
  reported_by: "ryan",
  start_date: null,
  due_date: "2026-08-24",
  due_time: null,
  reminder_at: null,
  priority: "high",
  board_position: 1024,
  completed_at: null,
  archived_at: null,
  created_at: "2026-08-20T12:00:00Z",
  updated_at: "2026-08-20T12:00:00Z",
  ...overrides,
});

const away: CalendarEvent = {
  id: "away-1",
  kind: "away",
  title: "Ryan is away",
  description: null,
  starts_at: "2026-08-27T00:00:00",
  ends_at: "2026-08-30T23:59:00",
  all_day: true,
  recurrence: null,
  project_id: null,
  category_id: null,
  profile_id: "ryan",
  created_by: "ryan",
  created_at: "2026-08-20T12:00:00Z",
  updated_at: "2026-08-20T12:00:00Z",
};

const project = (overrides: Partial<Project> = {}): Project => ({
  id: "website-refresh",
  name: "Website Refresh",
  description: null,
  links: [],
  created_by: "ryan",
  archived_at: null,
  created_at: "2026-08-01T12:00:00Z",
  start_date: "2026-08-20",
  due_date: "2026-09-15",
  status: "active",
  access_mode: "open",
  ...overrides,
});

describe("workspace time zone labels", () => {
  it("names the offset the date actually runs in", () => {
    expect(workspaceTimeZoneLabel("2026-08-20")).toBe("EDT");
    expect(workspaceTimeZoneLabel("2026-01-20")).toBe("EST");
    expect(workspaceTimeZoneLabel("2026-08-20", "long")).toBe(
      "Eastern Daylight Time",
    );
  });
});

// Every fixture happens in 2026, so one window wide enough to hold them keeps
// recurrence expansion out of the way of what each test is checking.
const range = { start: "2026-01-01", end: "2027-01-31" };

describe("calendar view models", () => {
  it("requires an explicit teammate for time away", () => {
    const draft = {
      kind: "away",
      title: "Out of office",
      description: "",
      startDate: "2026-08-27",
      endDate: "2026-08-30",
      allDay: true,
      startTime: "09:00",
      endTime: "17:00",
      projectId: "",
      categoryId: "",
      profileId: "",
    };
    expect(calendarEventSchema(draft)).toBeNull();
    expect(
      calendarEventSchema({
        ...draft,
        profileId: "4ca54e7a-19ee-4ee6-adc6-c54310a0ce51",
      }),
    ).toMatchObject({
      kind: "away",
      profileId: "4ca54e7a-19ee-4ee6-adc6-c54310a0ce51",
    });
  });

  it("creates task deadlines and hides completed or archived tasks", () => {
    const items = calendarItems(
      [task(), task({ id: "done", completed_at: "2026-08-21T12:00:00Z" })],
      [away],
      [],
      [],
      [],
      [],
      range,
    );
    expect(items.map((item) => item.source)).toEqual(["task", "away"]);
    expect(items[0].href).toBe("/task/TASK-12");
    expect(items[0].task?.title).toBe("Book the venue");
  });

  it("creates linked milestones for explicit dates on active projects", () => {
    const items = calendarItems(
      [],
      [],
      [
        project(),
        project({
          id: "undated",
          name: "Undated",
          start_date: null,
          due_date: null,
        }),
        project({
          id: "archived",
          name: "Archived",
          archived_at: "2026-08-30T12:00:00Z",
        }),
      ],
      [],
      [],
      [],
      range,
    );

    expect(items).toEqual([
      expect.objectContaining({
        id: "project:website-refresh:start",
        source: "important",
        title: "Website Refresh",
        start: "2026-08-20",
        end: "2026-08-20",
        href: "/projects/website-refresh",
        meta: "Project starts",
      }),
      expect.objectContaining({
        id: "project:website-refresh:due",
        source: "important",
        title: "Website Refresh",
        start: "2026-09-15",
        end: "2026-09-15",
        href: "/projects/website-refresh",
        meta: "Project due",
      }),
    ]);
  });

  it("includes a multi-day away entry on every date in its range", () => {
    const items = calendarItems(
      [],
      [away],
      [],
      [],
      [
        {
          id: "ryan",
          full_name: "Ryan Smith",
          avatar_url: null,
          onboarding_completed: true,
          task_details_open_by_default: false,
          assign_new_tasks_to_self: false,
          editor_surface: "auto",
          calendar_default_view: "all",
        },
      ],
      [],
      range,
    );
    expect(itemsOnDate(items, "2026-08-28")).toHaveLength(1);
    expect(itemsOnDate(items, "2026-08-31")).toHaveLength(0);
    expect(items[0].meta).toBe("Ryan Smith · Away");
  });

  it("carries an imported Google event so its tile can open the details dialog", () => {
    const event = {
      id: "google-1",
      title: "Planning call",
      start: "2026-08-20",
      end: "2026-08-20",
      allDay: false,
      htmlLink: "https://calendar.google.com/calendar/event?eid=example",
      description: "Agenda in the doc.",
    };
    const items = calendarItems([], [], [], [], [], [event], range);

    expect(items).toEqual([
      expect.objectContaining({
        id: "google:google-1",
        source: "google",
        title: "Planning call",
        color: "#2563eb",
        google: event,
      }),
    ]);
    // The tile no longer leaves for Google; the dialog offers that link instead.
    expect(items[0].href).toBeUndefined();
    expect(items[0].external).toBeUndefined();
  });

  it("leads an imported Google meeting with the hours it runs", () => {
    const items = calendarItems(
      [],
      [],
      [],
      [],
      [],
      [
        {
          id: "google-1",
          title: "Planning call",
          start: "2026-08-20",
          end: "2026-08-20",
          allDay: false,
          startTime: "09:00",
          endTime: "10:30",
        },
        {
          id: "google-2",
          title: "Offsite",
          start: "2026-08-20",
          end: "2026-08-22",
          allDay: false,
          startTime: "13:00",
          endTime: "17:00",
        },
        {
          id: "google-3",
          title: "Company holiday",
          start: "2026-08-20",
          end: "2026-08-20",
          allDay: true,
        },
      ],
      range,
    );

    expect(new Map(items.map((item) => [item.title, item.meta]))).toEqual(
      new Map([
        ["Planning call", "9:00 AM – 10:30 AM EDT"],
        // A meeting running past midnight can only say when it starts.
        ["Offsite", "1:00 PM EDT"],
        // The one connected calendar is not worth naming on every tile.
        ["Company holiday", undefined],
      ]),
    );
  });

  it("shows workspace event hours without labelling the date itself", () => {
    const timed: CalendarEvent = {
      ...away,
      id: "event-1",
      kind: "important",
      title: "Venue walkthrough",
      profile_id: null,
      all_day: false,
      starts_at: "2026-08-27T14:00:00",
      ends_at: "2026-08-27T15:30:00",
    };
    const allDay: CalendarEvent = {
      ...timed,
      id: "event-2",
      title: "Ryan Meetup California",
      all_day: true,
      starts_at: "2026-08-27T00:00:00",
      ends_at: "2026-08-27T23:59:00",
    };
    const items = calendarItems([], [timed, allDay], [], [], [], [], range);

    expect(new Map(items.map((item) => [item.title, item.meta]))).toEqual(
      new Map([
        ["Venue walkthrough", "2:00 PM – 3:30 PM EDT"],
        ["Ryan Meetup California", undefined],
      ]),
    );
  });

  it("shows a date published to Google once instead of twice", () => {
    const published: CalendarEvent = {
      ...away,
      id: "4ca54e7a-19ee-4ee6-adc6-c54310a0ce51",
      kind: "important",
      title: "Ryan Meetup California",
      profile_id: null,
      starts_at: "2026-09-11T00:00:00",
      ends_at: "2026-09-13T23:59:00",
    };
    const items = calendarItems(
      [],
      [published],
      [],
      [],
      [],
      [
        {
          id: workspaceGoogleEventId(published.id),
          title: "Ryan Meetup California",
          start: "2026-09-11",
          end: "2026-09-13",
          allDay: true,
        },
        {
          id: "google-1",
          title: "Planning call",
          start: "2026-09-11",
          end: "2026-09-11",
          allDay: false,
        },
      ],
      range,
    );

    expect(items.map((item) => item.id)).toEqual([
      `event:${published.id}:2026-09-11`,
      "google:google-1",
    ]);
  });

  it("accepts the Google publishing choice only as a boolean", () => {
    const draft = {
      kind: "important",
      title: "Ryan Meetup California",
      description: "",
      startDate: "2026-09-11",
      endDate: "2026-09-13",
      allDay: true,
      startTime: "09:00",
      endTime: "17:00",
      projectId: "",
      categoryId: "",
      profileId: "",
    };
    expect(calendarEventSchema(draft)).toMatchObject({ syncToGoogle: false });
    expect(calendarEventSchema({ ...draft, syncToGoogle: true })).toMatchObject(
      { syncToGoogle: true },
    );
    expect(calendarEventSchema({ ...draft, syncToGoogle: "yes" })).toBeNull();
  });

  it("keeps time away first when several item types share a date", () => {
    const sameDayAway = {
      ...away,
      starts_at: "2026-08-24T00:00:00",
      ends_at: "2026-08-24T23:59:00",
    };
    const items = calendarItems(
      [task()],
      [sameDayAway],
      [],
      [],
      [],
      [
        {
          id: "google-1",
          title: "Morning meeting",
          start: "2026-08-24",
          end: "2026-08-24",
          allDay: false,
        },
      ],
      range,
    );

    expect(itemsOnDate(items, "2026-08-24").map((item) => item.source)).toEqual(
      ["away", "task", "google"],
    );
  });

  it("builds a six-week Sunday-first month grid", () => {
    const bounds = monthBounds("2026-08");
    expect(bounds.days).toHaveLength(42);
    expect(bounds.days[0]).toBe("2026-07-26");
    expect(bounds.days[41]).toBe("2026-09-05");
  });
});
