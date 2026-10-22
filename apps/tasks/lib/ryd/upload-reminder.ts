import { WEEKDAY_LABELS, zonedParts } from "@/lib/digest/digest-settings";

/**
 * The weekly nudge to upload fulfillment's orders: a day and an hour in the
 * workspace's time zone (the one the task digest uses). Pure and client-safe:
 * the settings dialog, the page banner, and the worker share it.
 */
export type RydUploadReminder = {
  enabled: boolean;
  /** As `Date.getDay()` indexes. */
  weekday: number;
  /** Hour of the day, 0–23. */
  hour: number;
};

export const rydUploadReminderDefaults: RydUploadReminder = {
  enabled: true,
  weekday: 2,
  hour: 12,
};

const inRange = (value: unknown, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

/** Settings columns, absent before the migration, as a reminder. */
export function rydUploadReminderFrom(
  row: {
    upload_reminder_enabled?: boolean | null;
    upload_reminder_weekday?: number | null;
    upload_reminder_hour?: number | null;
  } | null,
): RydUploadReminder {
  return {
    enabled:
      typeof row?.upload_reminder_enabled === "boolean"
        ? row.upload_reminder_enabled
        : rydUploadReminderDefaults.enabled,
    weekday: inRange(row?.upload_reminder_weekday, 6)
      ? row.upload_reminder_weekday
      : rydUploadReminderDefaults.weekday,
    hour: inRange(row?.upload_reminder_hour, 23)
      ? row.upload_reminder_hour
      : rydUploadReminderDefaults.hour,
  };
}

export function isRydUploadReminder(
  value: unknown,
): value is RydUploadReminder {
  if (!value || typeof value !== "object") return false;
  const reminder = value as Record<string, unknown>;
  return (
    Object.keys(reminder).length === 3 &&
    typeof reminder.enabled === "boolean" &&
    inRange(reminder.weekday, 6) &&
    inRange(reminder.hour, 23)
  );
}

export function rydHourLabel(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/** "Tuesdays at 12 PM". */
export function rydUploadReminderLabel(reminder: RydUploadReminder) {
  return `${WEEKDAY_LABELS[reminder.weekday]}s at ${rydHourLabel(reminder.hour)}`;
}

/** Whether `now` falls in the reminder's hour. */
export function isRydUploadReminderSlot(
  reminder: RydUploadReminder,
  timeZone: string,
  now: Date,
) {
  if (!reminder.enabled) return false;
  const { weekday, hour } = zonedParts(now, timeZone);
  return weekday === reminder.weekday && hour === reminder.hour;
}

/**
 * The start of the most recent slot at or before `now`, or null when the
 * reminder is off. Walks back hour by hour, like the digest's next-run
 * search, so a DST shift resolves through the same formatter.
 */
export function latestRydUploadReminderSlot(
  reminder: RydUploadReminder,
  timeZone: string,
  now: Date,
) {
  if (!reminder.enabled) return null;
  const topOfHour = new Date(now);
  topOfHour.setUTCMinutes(0, 0, 0);
  for (let step = 0; step <= 24 * 8; step += 1) {
    const candidate = new Date(topOfHour.getTime() - step * 60 * 60 * 1000);
    if (isRydUploadReminderSlot(reminder, timeZone, candidate))
      return candidate;
  }
  return null;
}

/**
 * When the page should start asking for this week's file: the latest slot,
 * as long as nothing has been uploaded since it.
 */
export function rydUploadDueSince(
  reminder: RydUploadReminder,
  timeZone: string,
  lastUploadAt: string | null,
  now: Date,
) {
  const slot = latestRydUploadReminderSlot(reminder, timeZone, now);
  if (!slot) return null;
  if (lastUploadAt && Date.parse(lastUploadAt) >= slot.getTime()) return null;
  return slot.toISOString();
}
