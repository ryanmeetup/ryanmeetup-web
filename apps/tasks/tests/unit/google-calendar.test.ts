import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decryptGoogleRefreshToken,
  encryptGoogleRefreshToken,
  googleCalendarConnection,
  googleCalendarIntegrationValues,
  googleCalendarMonthRange,
  googleCalendarRedirectUri,
  isVisibleGoogleCalendarEvent,
  isGoogleCalendarConfigured,
  googleCalendarEventDetails,
  getGoogleCalendarEvent,
} from "@/lib/server/google-calendar";
import {
  workspaceGoogleEventBody,
  workspaceGoogleEventId,
} from "@/lib/calendar/google-calendar-sync";

function configure() {
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "client-secret");
  vi.stubEnv(
    "GOOGLE_CALENDAR_TOKEN_KEY",
    Buffer.alloc(32, 7).toString("base64"),
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("Google Calendar connection storage", () => {
  it("requires all OAuth settings and a 32-byte encryption key", () => {
    expect(isGoogleCalendarConfigured()).toBe(false);
    configure();
    expect(isGoogleCalendarConfigured()).toBe(true);
    vi.stubEnv(
      "GOOGLE_CALENDAR_TOKEN_KEY",
      Buffer.alloc(16).toString("base64"),
    );
    expect(isGoogleCalendarConfigured()).toBe(false);
  });

  it("encrypts refresh tokens before storing connection metadata", () => {
    configure();
    const encrypted = encryptGoogleRefreshToken("refresh-token");
    expect(encrypted).not.toContain("refresh-token");
    expect(decryptGoogleRefreshToken(encrypted)).toBe("refresh-token");

    const connection = googleCalendarIntegrationValues(
      "refresh-token",
      "ryan@example.com",
      "user-1",
    );
    expect(googleCalendarConnection(connection)).toMatchObject({
      connected: true,
      email: "ryan@example.com",
      calendarId: "primary",
    });
  });

  it("accepts only canonical year-month values", () => {
    expect(googleCalendarMonthRange("2026-08")).toEqual({
      start: "2026-07-25T00:00:00.000Z",
      end: "2026-09-08T00:00:00.000Z",
    });
    expect(googleCalendarMonthRange("2026-8")).toBeNull();
    expect(googleCalendarMonthRange("2026-13")).toBeNull();
  });

  it("hides the recurring Home event from imported calendar results", () => {
    expect(
      isVisibleGoogleCalendarEvent({
        eventType: "workingLocation",
        summary: "Home",
        workingLocationProperties: { type: "homeOffice" },
      }),
    ).toBe(false);
    expect(
      isVisibleGoogleCalendarEvent({
        eventType: "workingLocation",
        summary: "  home  ",
      }),
    ).toBe(false);
    expect(isVisibleGoogleCalendarEvent({ summary: "Home" })).toBe(true);
    expect(isVisibleGoogleCalendarEvent({ summary: "Planning call" })).toBe(
      true,
    );
  });

  it("keeps OAuth callbacks on the allowed origin where the connection started", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TASKS_APP_URL", "https://tasks.ryanmeetup.com");

    expect(
      googleCalendarRedirectUri(
        "http://localhost:3000/api/integrations/google-calendar/connect",
      ),
    ).toBe("http://localhost:3000/api/integrations/google-calendar/callback");
    expect(
      googleCalendarRedirectUri(
        "https://tasks.ryanmeetup.com/api/integrations/google-calendar/connect",
      ),
    ).toBe(
      "https://tasks.ryanmeetup.com/api/integrations/google-calendar/callback",
    );
  });
});

describe("workspace dates published to Google", () => {
  it("derives a stable Google event ID from the workspace UUID", () => {
    expect(workspaceGoogleEventId("4ca54e7a-19ee-4ee6-adc6-c54310a0ce51")).toBe(
      "4ca54e7a19ee4ee6adc6c54310a0ce51",
    );
  });

  it("sends all-day dates with Google's exclusive end date", () => {
    expect(
      workspaceGoogleEventBody({
        title: "Ryan Meetup California",
        description: "Hosting Ready Player Ryan.",
        starts_at: "2026-09-11T00:00:00",
        ends_at: "2026-09-13T23:59:00",
        all_day: true,
        recurrence: null,
      }),
    ).toEqual({
      summary: "Ryan Meetup California",
      description: "Hosting Ready Player Ryan.",
      recurrence: [],
      start: { date: "2026-09-11" },
      end: { date: "2026-09-14" },
    });
  });

  it("sends timed dates in the workspace time zone", () => {
    expect(
      workspaceGoogleEventBody({
        title: "Planning call",
        description: null,
        starts_at: "2026-09-11T09:00:00",
        ends_at: "2026-09-11T10:30:00",
        all_day: false,
        recurrence: null,
      }),
    ).toEqual({
      summary: "Planning call",
      description: undefined,
      recurrence: [],
      start: { dateTime: "2026-09-11T09:00:00", timeZone: "America/New_York" },
      end: { dateTime: "2026-09-11T10:30:00", timeZone: "America/New_York" },
    });
  });

  it("publishes a repeating date as one Google series", () => {
    expect(
      workspaceGoogleEventBody({
        title: "Weekly Ryan sync",
        description: null,
        starts_at: "2026-09-07T00:00:00",
        ends_at: "2026-09-07T23:59:00",
        all_day: true,
        recurrence: {
          frequency: "weekly",
          interval: 2,
          weekdays: [1, 3],
          monthlyMode: "date",
          ends: { type: "on", date: "2026-12-07" },
        },
      }).recurrence,
    ).toEqual(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261207"]);
  });

  // A timed series is compared as an instant, so the workspace zone being
  // behind UTC must not drop the last day the author asked for.
  it("keeps the last day of a timed series inside its end date", () => {
    expect(
      workspaceGoogleEventBody({
        title: "Planning call",
        description: null,
        starts_at: "2026-09-07T09:00:00",
        ends_at: "2026-09-07T10:00:00",
        all_day: false,
        recurrence: {
          frequency: "daily",
          interval: 1,
          weekdays: [],
          monthlyMode: "date",
          ends: { type: "on", date: "2026-09-30" },
        },
      }).recurrence,
    ).toEqual(["RRULE:FREQ=DAILY;UNTIL=20260930T235959Z"]);
  });
});

describe("Google event details", () => {
  it("normalizes the invite into what the details dialog shows", () => {
    expect(
      googleCalendarEventDetails({
        id: "google-1",
        status: "tentative",
        summary: "Venue walkthrough",
        description: "<p>Bring the <b>deck</b>.</p><p>Notes: &lt;none&gt;</p>",
        location: "The Ryan Bar, Brooklyn",
        organizer: { email: "ryan@ryanmeetup.com", displayName: "Ryan Smith" },
        hangoutLink: "https://meet.google.com/abc-defg-hij",
        attendees: [
          {
            email: "ryan@ryanmeetup.com",
            responseStatus: "accepted",
            organizer: true,
          },
          { email: "other@ryanmeetup.com", responseStatus: "needsAction" },
        ],
        attachments: [
          {
            title: "Walkthrough notes",
            fileUrl: "https://docs.google.com/document/d/1",
          },
        ],
      }),
    ).toEqual({
      description: "Bring the deck.\n\nNotes: <none>",
      location: "The Ryan Bar, Brooklyn",
      tentative: true,
      organizer: { name: "Ryan Smith", email: "ryan@ryanmeetup.com" },
      attendees: [
        {
          email: "ryan@ryanmeetup.com",
          name: undefined,
          response: "accepted",
          organizer: true,
          optional: undefined,
          self: undefined,
          resource: undefined,
        },
        {
          email: "other@ryanmeetup.com",
          name: undefined,
          response: "needsAction",
          organizer: undefined,
          optional: undefined,
          self: undefined,
          resource: undefined,
        },
      ],
      attendeeCount: 2,
      guestCount: 2,
      conference: [
        {
          kind: "video",
          label: "Google Meet",
          uri: "https://meet.google.com/abc-defg-hij",
        },
      ],
      attachments: [
        {
          title: "Walkthrough notes",
          url: "https://docs.google.com/document/d/1",
        },
      ],
    });
  });

  // An invite mirrored from Teams: Google files no conference data for it, so
  // everything the dialog leads with has to be read back out of the body and
  // the room it booked arrives looking like one more guest.
  it("recovers the room and the head count from an invite Google did not file", () => {
    const details = googleCalendarEventDetails({
      id: "google-3",
      summary: "Ryan Meetup x Yard House Intro Call",
      location: "Microsoft Teams Meeting; 2N-PAC",
      description: [
        "<div>Microsoft Teams meeting</div>",
        '<div>Join: <a href="https://teams.microsoft.com/meet/271183?p=IxtZY6">https://teams.microsoft.com/meet/271183?p=IxtZY6</a></div>',
        "<div>Passcode: Mp7fD3KE</div>",
      ].join(""),
      attendees: [
        { email: "ryan@ryanmeetup.com", self: true },
        {
          email: "kbateman1@darden.com",
          displayName: "Kelly Bateman",
          organizer: true,
          responseStatus: "accepted",
        },
        { email: "2n-pac@darden.com", displayName: "2N-PAC" },
        { email: "baliberti@darden.com", displayName: "Brandon Aliberti" },
      ],
    });
    expect(details.conference).toEqual([
      {
        kind: "video",
        label: "Microsoft Teams",
        uri: "https://teams.microsoft.com/meet/271183?p=IxtZY6",
        meetingCode: undefined,
        pin: "Mp7fD3KE",
      },
    ]);
    expect(details.attendeeCount).toBe(4);
    expect(details.guestCount).toBe(3);
    expect(
      details.attendees?.find(
        (attendee) => attendee.email === "2n-pac@darden.com",
      )?.resource,
    ).toBe(true);
  });

  // A bare busy block should not travel with a payload of empty fields.
  it("leaves every detail unset when Google shared none of them", () => {
    expect(
      googleCalendarEventDetails({ id: "google-2", summary: "Busy" }),
    ).toEqual({
      location: undefined,
      tentative: undefined,
      organizer: undefined,
      conference: undefined,
      attachments: undefined,
    });
  });
});

describe("one Google event for its own page", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Answer the token exchange, then the event request with `event`. */
  function google(event: Response) {
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requests.push(url);
        if (url.includes("oauth2")) return Response.json({ access_token: "token" });
        return event;
      }),
    );
    return requests;
  }

  function connection() {
    configure();
    return {
      ...googleCalendarIntegrationValues("refresh-token", "ryan@example.com", "user-1"),
      calendar_id: "team@example.com",
    } as Parameters<typeof getGoogleCalendarEvent>[0];
  }

  it("reads the event in the workspace zone and shapes it like the month list", async () => {
    const requests = google(
      Response.json({
        id: "abc_20261123T150000Z",
        summary: " Standup ",
        status: "confirmed",
        start: { dateTime: "2026-11-23T10:00:00-05:00" },
        end: { dateTime: "2026-11-23T10:15:00-05:00" },
        htmlLink: "https://calendar.google.com/event?eid=abc",
      }),
    );
    await expect(getGoogleCalendarEvent(connection(), "abc_20261123T150000Z")).resolves.toMatchObject({
      id: "abc_20261123T150000Z",
      title: "Standup",
      start: "2026-11-23",
      startTime: "10:00",
      endTime: "10:15",
      allDay: false,
    });
    const eventRequest = new URL(requests.at(-1)!);
    expect(eventRequest.pathname).toBe("/calendar/v3/calendars/team%40example.com/events/abc_20261123T150000Z");
    expect(eventRequest.searchParams.get("timeZone")).toBeTruthy();
  });

  it("has no event when Google has none or the calendar would hide it", async () => {
    google(new Response("", { status: 404 }));
    await expect(getGoogleCalendarEvent(connection(), "gone")).resolves.toBeNull();
    google(
      Response.json({
        id: "cancelled",
        status: "cancelled",
        start: { date: "2026-11-23" },
        end: { date: "2026-11-24" },
      }),
    );
    await expect(getGoogleCalendarEvent(connection(), "cancelled")).resolves.toBeNull();
  });

  it("throws when Google fails, rather than claiming the event is gone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    google(new Response("boom", { status: 500 }));
    await expect(getGoogleCalendarEvent(connection(), "abc")).rejects.toThrow();
  });
});
