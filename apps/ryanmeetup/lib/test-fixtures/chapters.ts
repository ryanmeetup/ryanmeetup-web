import type {
  ContentfulImage,
  FrequentlyAskedQuestion,
  RyanChapter,
  RyanEvent,
} from "@/lib/types";
import { createImage } from "@/lib/test-fixtures/images";
import { addDays, createEvent, formatDateTime } from "@/lib/test-fixtures/events";


const createChapter = (overrides: Partial<RyanChapter> & { active?: boolean } = {}) =>
  ({
    city: "New York",
    slug: "new-york",
    state: "NY",
    chapterLeads: ["Ryan A"],
    whatsAppLink: "https://chat.whatsapp.com/example",
    coverImage: createImage("ryanroundup.png"),
    instagram: "https://www.instagram.com/ryanmeetup/",
    avatar: createImage("ryanroundup.png"),
    active: true,
    ...overrides,
  } as RyanChapter & { active?: boolean; avatar?: ContentfulImage });

const chapterFaqs: FrequentlyAskedQuestion[] = [
  {
    question: "How do I start a chapter?",
    answer: "Reach out to Ryan for next steps.",
    type: "chapter",
    loadOrder: 1,
  },
];

const chaptersBase = [
  createChapter(),
  createChapter({
    city: "Chicago",
    slug: "chicago",
    state: "IL",
    chapterLeads: ["Ryan B"],
    instagram: "https://www.instagram.com/ryanchicago/",
  }),
];

const chaptersFixtures: Record<
  string,
  { chapters: (RyanChapter & { active?: boolean })[]; events: RyanEvent[]; faqs: FrequentlyAskedQuestion[] }
> = {
  "with-upcoming": {
    chapters: chaptersBase,
    events: [
      createEvent({
        title: "New York Chapter Meetup",
        date: addDays(7),
        dateTime: formatDateTime(addDays(7)),
        chapter: ["New York"],
        city: "New York, NY",
      }),
      createEvent({
        title: "Chicago Chapter Meetup",
        date: addDays(-14),
        dateTime: formatDateTime(addDays(-14)),
        chapter: ["Chicago"],
        city: "Chicago, IL",
      }),
    ],
    faqs: chapterFaqs,
  },
  "no-upcoming": {
    chapters: chaptersBase,
    events: [
      createEvent({
        title: "New York Chapter Meetup",
        date: addDays(-30),
        dateTime: formatDateTime(addDays(-30)),
        chapter: ["New York"],
        city: "New York, NY",
      }),
    ],
    faqs: chapterFaqs,
  },
};

const chapterSlugFixtures: Record<
  string,
  { chapter: RyanChapter & { active?: boolean; avatar?: ContentfulImage }; events: RyanEvent[] }
> = {
  upcoming: {
    chapter: createChapter(),
    events: [
      createEvent({
        title: "Upcoming New York Meetup",
        date: addDays(5),
        dateTime: formatDateTime(addDays(5)),
        chapter: ["New York"],
        city: "New York, NY",
      }),
      createEvent({
        title: "Past New York Meetup",
        date: addDays(-10),
        dateTime: formatDateTime(addDays(-10)),
        chapter: ["New York"],
        city: "New York, NY",
      }),
    ],
  },
  "past-only": {
    chapter: createChapter(),
    events: [
      createEvent({
        title: "Past New York Meetup",
        date: addDays(-20),
        dateTime: formatDateTime(addDays(-20)),
        chapter: ["New York"],
        city: "New York, NY",
      }),
    ],
  },
  none: {
    chapter: createChapter(),
    events: [],
  },
};

const getChaptersFixture = (fixture?: string) => {
  if (fixture && chaptersFixtures[fixture]) {
    return chaptersFixtures[fixture];
  }

  return chaptersFixtures["with-upcoming"];
};

const getChapterSlugFixture = (slug: string, fixture?: string) => {
  const base = createChapter({
    city: slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    slug,
  });

  const selected =
    fixture && chapterSlugFixtures[fixture]
      ? chapterSlugFixtures[fixture]
      : chapterSlugFixtures.upcoming;

  return {
    chapter: { ...selected.chapter, city: base.city, slug: base.slug },
    events: selected.events.map((event) => ({
      ...event,
      chapter: [base.city],
      city: `${base.city}, ${base.state}`,
    })),
  };
};

export { getChaptersFixture, getChapterSlugFixture };
