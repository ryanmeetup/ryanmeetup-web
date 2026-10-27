import { describe, expect, it } from "vitest";
import { rydSettingsSchema } from "@/lib/api-schema/ryd";
import {
  isRydUploadReminderSlot,
  latestRydUploadReminderSlot,
  rydUploadDueSince,
  rydUploadDueLabel,
  rydUploadReminderDefaults,
  rydUploadReminderFrom,
  rydUploadReminderLabel,
} from "@/lib/ryd/upload-reminder";
import { rydQueueSummary } from "@/lib/server/ryd-upload-reminder-email";

const zone = "America/New_York";
const tuesday = rydUploadReminderDefaults;
// Tuesday, October 20, 2026 at noon in New York (EDT, UTC-4).
const tuesdayNoon = new Date("2026-10-20T16:00:00Z");

describe("RY-D upload reminder", () => {
  it("defaults to Tuesdays at noon, on", () => {
    expect(rydUploadReminderFrom(null)).toEqual({
      enabled: true,
      weekday: 2,
      hour: 12,
    });
    expect(rydUploadReminderLabel(tuesday)).toBe("Tuesdays at 12 PM");
  });

  it("reads saved columns and ignores ones out of range", () => {
    expect(
      rydUploadReminderFrom({
        upload_reminder_enabled: false,
        upload_reminder_weekday: 4,
        upload_reminder_hour: 30,
      }),
    ).toEqual({ enabled: false, weekday: 4, hour: 12 });
  });

  it.each([
    ["2026-10-20T16:00:00Z", "America/New_York", "Tuesday at 12 PM"],
    ["2026-10-21T04:00:00Z", "America/New_York", "Wednesday at 12 AM"],
    ["2026-10-21T01:00:00Z", "America/New_York", "Tuesday at 9 PM"],
    ["2026-10-20T16:00:00Z", "Asia/Tokyo", "Wednesday at 1 AM"],
    ["2026-11-03T17:00:00Z", "America/New_York", "Tuesday at 12 PM"],
  ])("labels %s in %s as %s", (since, timeZone, label) => {
    expect(rydUploadDueLabel(since, timeZone)).toBe(label);
  });

  it("sends only in the slot's hour, in the workspace zone", () => {
    expect(isRydUploadReminderSlot(tuesday, zone, tuesdayNoon)).toBe(true);
    expect(
      isRydUploadReminderSlot(
        tuesday,
        zone,
        new Date("2026-10-20T16:59:00Z"),
      ),
    ).toBe(true);
    expect(
      isRydUploadReminderSlot(
        tuesday,
        zone,
        new Date("2026-10-20T12:00:00Z"),
      ),
    ).toBe(false);
    expect(
      isRydUploadReminderSlot(
        { ...tuesday, enabled: false },
        zone,
        tuesdayNoon,
      ),
    ).toBe(false);
  });

  it("finds the latest slot, across a DST change", () => {
    // Tuesday, November 3, 2026, after clocks fall back to EST (UTC-5).
    expect(
      latestRydUploadReminderSlot(
        tuesday,
        zone,
        new Date("2026-11-04T09:00:00Z"),
      )?.toISOString(),
    ).toBe("2026-11-03T17:00:00.000Z");
    expect(
      latestRydUploadReminderSlot(
        tuesday,
        zone,
        new Date("2026-10-20T15:59:00Z"),
      )?.toISOString(),
    ).toBe("2026-10-13T16:00:00.000Z");
  });

  it("asks for the file from the slot until someone uploads", () => {
    const thursday = new Date("2026-10-22T14:00:00Z");
    expect(rydUploadDueSince(tuesday, zone, null, thursday)).toBe(
      "2026-10-20T16:00:00.000Z",
    );
    expect(
      rydUploadDueSince(tuesday, zone, "2026-10-19T12:00:00Z", thursday),
    ).toBe("2026-10-20T16:00:00.000Z");
    expect(
      rydUploadDueSince(tuesday, zone, "2026-10-20T17:30:00Z", thursday),
    ).toBeNull();
    expect(
      rydUploadDueSince({ ...tuesday, enabled: false }, zone, null, thursday),
    ).toBeNull();
  });

  it("validates the reminder in the settings body", () => {
    expect(
      rydSettingsSchema({
        uploadReminder: { enabled: true, weekday: 3, hour: 9 },
      }),
    ).toEqual({ uploadReminder: { enabled: true, weekday: 3, hour: 9 } });
    expect(
      rydSettingsSchema({
        uploadReminder: { enabled: true, weekday: 7, hour: 9 },
      }),
    ).toBeNull();
    expect(
      rydSettingsSchema({
        uploadReminder: { enabled: true, weekday: 2, hour: 12, extra: 1 },
      }),
    ).toBeNull();
  });

  it("mentions what's still waiting only when something is", () => {
    expect(rydQueueSummary({ pending: 0, needsInfo: 0 })).toBeNull();
    expect(rydQueueSummary({ pending: 3, needsInfo: 1 })).toBe(
      "The queue still has 3 pending and 1 waiting on more info from earlier weeks.",
    );
  });
});
