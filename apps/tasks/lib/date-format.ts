/**
 * The workspace's shared date and time vocabulary.
 *
 * Every screen that shows a moment in time was building its own
 * `Intl.DateTimeFormat`, which is both expensive to construct and easy to let
 * drift. These formats are the whole vocabulary; reach for one of them
 * rather than spelling out options at a call site.
 *
 * Calendar, digest, and Google Calendar code deliberately keeps its own
 * formatters. Those derive timezone-specific sort keys and schedule
 * boundaries rather than presenting a value to a reader.
 */

type Timestamp = string | number | Date;

const toDate = (value: Timestamp) =>
  value instanceof Date ? value : new Date(value);

const formatter = (options: Intl.DateTimeFormatOptions) => {
  const instance = new Intl.DateTimeFormat("en-US", options);
  return (value: Timestamp) => instance.format(toDate(value));
};

/**
 * A timestamp in full: `Aug 27, 2026, 2:30 PM`. The default for anything
 * carrying a clock time — comments, activity rows, email sends.
 */
export const formatTimestamp = formatter({
  dateStyle: "medium",
  timeStyle: "short",
});

/** A timestamp with the clock time dropped: `Aug 27, 2026`. */
export const formatTimestampDate = formatter({ dateStyle: "medium" });

/**
 * A timestamp for dense rows, where the year is clear from context but the
 * time still matters: `Aug 27, 2:30 PM`.
 */
export const formatShortTimestamp = formatter({
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * Calendar dates arrive as `YYYY-MM-DD` with no instant attached, so they are
 * anchored at midday before formatting. Parsing one as midnight would let any
 * timezone west of UTC render the previous day.
 */
const calendarFormatter = (options: Intl.DateTimeFormatOptions) => {
  const format = formatter({ ...options, timeZone: "UTC" });
  return (date: string) => format(`${date}T12:00:00Z`);
};

/** A calendar date without its year: `Aug 27`. */
export const formatCalendarDay = calendarFormatter({
  month: "short",
  day: "numeric",
});

/** The month a group of rows belongs to: `August 2026`. */
export const formatMonth = formatter({ month: "long", year: "numeric" });

/** A calendar date in full: `Aug 27, 2026`. */
export const formatCalendarDate = calendarFormatter({
  month: "short",
  day: "numeric",
  year: "numeric",
});
