/** A source that can be shown or hidden independently on Calendar. */
export type CalendarSource = "task" | "away" | "important" | "google";

/** The sources Calendar selects when a person opens it. */
export type CalendarDefaultView = CalendarSource[];

export const calendarSourceOptions: readonly {
  value: CalendarSource;
  label: string;
}[] = [
  { value: "task", label: "Deadlines" },
  { value: "away", label: "Time away" },
  { value: "important", label: "Important dates" },
  { value: "google", label: "Google Calendar" },
];

export const defaultCalendarView: CalendarDefaultView =
  calendarSourceOptions.map(({ value }) => value);

const calendarSources = new Set<CalendarSource>(
  calendarSourceOptions.map(({ value }) => value),
);

export function isCalendarSource(value: unknown): value is CalendarSource {
  return (
    typeof value === "string" && calendarSources.has(value as CalendarSource)
  );
}

export function isCalendarDefaultView(
  value: unknown,
): value is CalendarDefaultView {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    value.every(isCalendarSource)
  );
}

export function calendarDefaultView(value: unknown): CalendarDefaultView {
  return isCalendarDefaultView(value) ? [...value] : [...defaultCalendarView];
}

/** Remove Google when it is unavailable, while always leaving a useful view. */
export function availableCalendarDefaultView(
  value: unknown,
  googleAvailable: boolean,
): CalendarDefaultView {
  const preference = calendarDefaultView(value);
  if (googleAvailable) return preference;
  const available = preference.filter((source) => source !== "google");
  return available.length
    ? available
    : defaultCalendarView.filter((source) => source !== "google");
}

export function calendarDefaultViewDescription(
  value: CalendarDefaultView,
): string {
  if (value.length === calendarSourceOptions.length)
    return "Open the calendar with every available source visible.";
  const labels = calendarSourceOptions
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);
  return `Open the calendar with ${labels.join(", ")} visible.`;
}
