/** Which source the Calendar's Show menu selects when a person opens it. */
export type CalendarDefaultView =
  "all" | "task" | "away" | "important" | "google";

export const defaultCalendarView: CalendarDefaultView = "all";

export const calendarDefaultViewOptions: readonly {
  value: CalendarDefaultView;
  label: string;
  description: string;
}[] = [
  {
    value: "all",
    label: "Everything",
    description: "Open the calendar with every available source visible.",
  },
  {
    value: "task",
    label: "Deadlines",
    description: "Open with only task deadlines visible.",
  },
  {
    value: "away",
    label: "Time away",
    description: "Open with only time-away entries visible.",
  },
  {
    value: "important",
    label: "Important dates",
    description: "Open with only important workspace dates visible.",
  },
  {
    value: "google",
    label: "Google Calendar",
    description: "Open with only imported Google Calendar events visible.",
  },
];

export function isCalendarDefaultView(
  value: unknown,
): value is CalendarDefaultView {
  return calendarDefaultViewOptions.some((option) => option.value === value);
}

export function calendarDefaultView(value: unknown): CalendarDefaultView {
  return isCalendarDefaultView(value) ? value : defaultCalendarView;
}

/** A Google-only default cannot be selected until that source is available. */
export function availableCalendarDefaultView(
  value: unknown,
  googleAvailable: boolean,
): CalendarDefaultView {
  const preference = calendarDefaultView(value);
  return preference === "google" && !googleAvailable
    ? defaultCalendarView
    : preference;
}
