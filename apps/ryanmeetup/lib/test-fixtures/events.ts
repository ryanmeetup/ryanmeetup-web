import type { RyanEvent } from "@/lib/types";

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const formatDateTime = (date: Date) => date.toDateString();

const createEvent = (overrides: Partial<RyanEvent>): RyanEvent => ({
  active: true,
  coverImage: "/trophy.png",
  description: "Test event description.",
  href: "/events",
  title: "Test Event",
  date: new Date(),
  dateTime: formatDateTime(new Date()),
  city: "New York, NY",
  location: "New York, NY",
  venue: "Ryan Meetup HQ",
  isPartnerEvent: false,
  eventType: "Main",
  chapter: ["Main"],
  ...overrides,
});

const fixtures: Record<string, RyanEvent[]> = {
  "past-only": [
    createEvent({
      title: "Past Ryan Meetup",
      date: addDays(-30),
      dateTime: formatDateTime(addDays(-30)),
      chapter: ["Main"],
    }),
    createEvent({
      title: "Older Ryan Meetup",
      date: addDays(-120),
      dateTime: formatDateTime(addDays(-120)),
      chapter: ["Main"],
    }),
  ],
  "with-upcoming": [
    createEvent({
      title: "Upcoming Ryan Meetup",
      date: addDays(10),
      dateTime: formatDateTime(addDays(10)),
      chapter: ["Main"],
    }),
    createEvent({
      title: "Past Ryan Meetup",
      date: addDays(-45),
      dateTime: formatDateTime(addDays(-45)),
      chapter: ["Main"],
    }),
  ],
  "with-chapters": [
    createEvent({
      title: "Chapter Ryan Meetup",
      date: addDays(12),
      dateTime: formatDateTime(addDays(12)),
      chapter: ["Chicago"],
    }),
  ],
};

const getTestEvents = (fixture?: string) => {
  if (fixture && fixtures[fixture]) {
    return fixtures[fixture];
  }

  return fixtures["with-upcoming"];
};

export { getTestEvents, addDays, formatDateTime, createEvent };
