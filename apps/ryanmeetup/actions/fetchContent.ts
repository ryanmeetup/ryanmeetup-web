"use server";

import * as contentful from "contentful";
import { unstable_cache } from "next/cache";

const client = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE_ID as string,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN as string,
});

const CMS_REVALIDATE_SECONDS = 600;

const fetchEvents = unstable_cache(
  async () => {
    const data = await client.getEntries({
      content_type: "event",
      // @ts-ignore
      order: "-fields.date",
    });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-events"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchFAQs = unstable_cache(
  async () => {
    const data = await client.getEntries({ content_type: "faq" });

    return data.items.map((entry) => entry.fields).reverse();
  },
  ["contentful-faqs"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchArticles = unstable_cache(
  async () => {
    const data = await client.getEntries({
      content_type: "article",
      // @ts-ignore
      order: "-fields.publishDate",
    });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-articles"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchMedia = unstable_cache(
  async () => {
    const data = await client.getEntries({
      content_type: "gallery",
      // @ts-ignore
      order: "-fields.date",
    });

    return data.items;
  },
  ["contentful-media"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchSingleMediaEvent = unstable_cache(
  async (id: string) => {
    const data = await client.getEntry(id);

    return data.fields;
  },
  ["contentful-media-event"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchLocations = unstable_cache(
  async () => {
    const limit = 1000;
    const firstPage = await client.getEntries({
      content_type: "locations",
      limit,
      skip: 0,
    });
    const items = [...firstPage.items];

    while (items.length < firstPage.total) {
      const page = await client.getEntries({
        content_type: "locations",
        limit,
        skip: items.length,
      });

      if (page.items.length === 0) {
        break;
      }

      items.push(...page.items);
    }

    return items.map((entry) => entry.fields);
  },
  ["contentful-locations"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchFarthestRyans = unstable_cache(
  async () => {
    const data = await client.getEntries({
      content_type: "farthest",
      // @ts-ignore
      order: "-fields.date",
    });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-farthest-ryans"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchChampionRyans = unstable_cache(
  async () => {
    const data = await client.getEntries({
      content_type: "champion",
      // @ts-ignore
      order: "-fields.date",
    });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-champion-ryans"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchRepeatRyans = unstable_cache(
  async () => {
    const data = await client.getEntries({ content_type: "leaderboard" });

    // Ryans share names often enough that the entry id has to come along as
    // the row identity.
    return data.items.map((entry) => ({ ...entry.fields, id: entry.sys.id }));
  },
  ["contentful-repeat-ryans"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

// The `eventsAttended` checkbox options are maintained in chronological order,
// which makes the content type's validation list the canonical event timeline.
const fetchEventTimeline = unstable_cache(
  async () => {
    const contentType = await client.getContentType("leaderboard");
    const field = contentType.fields.find(
      (entry) => entry.id === "eventsAttended",
    );
    const ordered = field?.items?.validations.find((rule) => rule.in);

    return ordered?.in ?? [];
  },
  ["contentful-event-timeline"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchChapters = unstable_cache(
  async () => {
    const data = await client.getEntries({ content_type: "chapter" });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-chapters"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchSingleChapter = unstable_cache(
  async (slug: string) => {
    const entries = await client.getEntries({
      content_type: "chapter",
      "fields.slug": slug,
      limit: 1,
    });

    if (entries.items[0]) {
      return entries.items[0].fields;
    }

    return null;
  },
  ["contentful-single-chapter"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchSponsors = unstable_cache(
  async () => {
    const data = await client.getEntries({ content_type: "sponsor" });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-sponsors"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchOutlets = unstable_cache(
  async () => {
    const data = await client.getEntries({
      content_type: "outlets",
      // @ts-ignore
      order: "sys.updatedAt",
    });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-outlets"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchTestimonies = unstable_cache(
  async () => {
    const data = await client.getEntries({ content_type: "testimony" });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-testimonies"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchDonations = unstable_cache(
  async () => {
    const data = await client.getEntries({ content_type: "charitableEfforts" });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-donations"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

const fetchFlyers = unstable_cache(
  async () => {
    const data = await client.getEntries({
      content_type: "flyer",
      // @ts-ignore
      order: "-fields.date",
    });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-flyers"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

// The `baseballTeam` content type may not exist in Contentful yet, and the
// Classic page is unlisted until it does; callers treat a rejection as "no
// teams announced" rather than as fixture data.
const fetchBaseballTeams = unstable_cache(
  async () => {
    const data = await client.getEntries({
      content_type: "baseballTeam",
      // @ts-ignore -- the SDK's order typing only accepts sys fields without a content type generic.
      order: "fields.gameDate",
      limit: 1000,
    });

    return data.items.map((entry) => entry.fields);
  },
  ["contentful-baseball-teams"],
  { revalidate: CMS_REVALIDATE_SECONDS },
);

export {
  fetchBaseballTeams,
  fetchEvents,
  fetchFAQs,
  fetchArticles,
  fetchMedia,
  fetchSingleMediaEvent,
  fetchLocations,
  fetchFarthestRyans,
  fetchChampionRyans,
  fetchRepeatRyans,
  fetchEventTimeline,
  fetchChapters,
  fetchSingleChapter,
  fetchSponsors,
  fetchOutlets,
  fetchTestimonies,
  fetchDonations,
  fetchFlyers,
};
