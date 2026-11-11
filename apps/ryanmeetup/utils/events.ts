import type { RyanEvent } from "@/lib/types";
import { sortEventsByDate, splitEventsByTime } from "@/utils/date";

const buildEventSearchText = (event: RyanEvent) =>
  [
    event.title,
    event.city,
    event.venue,
    event.description,
    Array.isArray(event.eventType)
      ? event.eventType.join(" ")
      : event.eventType,
    event.chapter?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const filterEventsByQuery = (events: RyanEvent[], query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return events;
  return events.filter((event) => buildEventSearchText(event).includes(needle));
};

const getEventsByView = (events: RyanEvent[], view: "upcoming" | "past") => {
  const { upcoming, past } = splitEventsByTime(events);
  return view === "upcoming" ? upcoming : past;
};

const getSortedEventsByView = (
  events: RyanEvent[],
  view: "upcoming" | "past",
  sortOrder?: "asc" | "desc",
) => {
  const order = sortOrder ?? (view === "upcoming" ? "asc" : "desc");
  return sortEventsByDate(getEventsByView(events, view), order);
};

const getEventEmptyMessage = (view: "upcoming" | "past") =>
  view === "upcoming"
    ? "No upcoming events right now. Check back soon!"
    : "No past events yet.";

const hasEventTag = (value: string | string[] | undefined, tag: string) => {
  if (Array.isArray(value)) return value.includes(tag);
  return value === tag;
};

const isMainEvent = (event: RyanEvent) =>
  hasEventTag(event.eventType, "Main") || hasEventTag(event.chapter, "Main");

const isRyanEmbassyEvent = (event: RyanEvent) =>
  [event.title, event.venue].some((value) =>
    value?.toLowerCase().includes("ryan embassy"),
  );

const getEventCtaLabel = (event: RyanEvent, fallbackLabel: string) => {
  if (fallbackLabel.toLowerCase() === "rsvp" && isRyanEmbassyEvent(event)) {
    return "Book a room";
  }

  return fallbackLabel;
};

export {
  buildEventSearchText,
  filterEventsByQuery,
  getEventsByView,
  getSortedEventsByView,
  getEventEmptyMessage,
  getEventCtaLabel,
  isMainEvent,
};
