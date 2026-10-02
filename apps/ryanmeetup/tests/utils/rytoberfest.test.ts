import { expect, test } from "@playwright/test";

import { createEvent } from "@/lib/test-fixtures/events";
import {
  getUpcomingRytoberfestEvents,
  isRytoberfestEvent,
} from "@/utils/events";

const NOW = new Date("2026-10-02T12:00:00-04:00").getTime();

test.describe("Rytoberfest event collection", () => {
  test("recognizes Rytoberfest in an event title or event type", () => {
    expect(
      isRytoberfestEvent(createEvent({ title: "Denver Rytoberfest 2026" })),
    ).toBe(true);
    expect(
      isRytoberfestEvent(
        createEvent({ title: "Ryan Social", eventType: ["Rytoberfest"] }),
      ),
    ).toBe(true);
    expect(isRytoberfestEvent(createEvent({ title: "Ryan Social" }))).toBe(
      false,
    );
  });

  test("returns only upcoming Rytoberfest events in date order", () => {
    const events = [
      createEvent({ title: "Later Rytoberfest", date: "2026-10-17" }),
      createEvent({ title: "Past Rytoberfest", date: "2026-09-30" }),
      createEvent({ title: "Sooner Rytoberfest", date: "2026-10-03" }),
      createEvent({ title: "Regular meetup", date: "2026-10-04" }),
    ];

    expect(
      getUpcomingRytoberfestEvents(events, NOW).map((event) => event.title),
    ).toEqual(["Sooner Rytoberfest", "Later Rytoberfest"]);
  });
});
