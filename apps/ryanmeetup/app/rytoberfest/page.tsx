import NextImage from "next/image";
import { FaArrowDown as ArrowDown } from "react-icons/fa6";
import { IoLocationOutline as Location } from "react-icons/io5";

import { fetchEvents } from "@/actions/fetchContent";
import { UpcomingEventsList } from "@/components/events";
import { Layout } from "@/components/navigation";
import { getTestEvents } from "@/lib/test-fixtures/events";
import type { RyanEvent } from "@/lib/types";
import { getUpcomingRytoberfestEvents } from "@/utils/events";
import { buildPageMetadata } from "@/utils/metadata";
import {
  Button,
  Divider,
  EmptyState,
  Heading,
  Pill,
  Text,
} from "@ryanmeetup/ui";

export const metadata = buildPageMetadata({
  title: "Rytoberfest Events | Ryan Meetup",
  description:
    "Find every upcoming Rytoberfest hosted by Ryan Meetup chapters and RSVP for the celebration nearest you.",
  canonical: "https://ryanmeetup.com/rytoberfest",
  image: {
    url: "https://ryanmeetup.com/group-photos/rytober.jpg",
    width: 1437,
    height: 958,
    alt: "Ryans celebrating together at Rytoberfest",
  },
  keywords: [
    "rytoberfest",
    "rytoberfest events",
    "ryan meetup rytoberfest",
    "ryan meetup chapter events",
    "oktoberfest for ryans",
  ],
});

const RytoberfestPage = async ({
  searchParams,
}: {
  searchParams?: Promise<{ fixture?: string }>;
}) => {
  const resolvedSearchParams = await searchParams;
  const events =
    process.env.E2E_TESTS === "true"
      ? getTestEvents(resolvedSearchParams?.fixture)
      : await fetchEvents();
  const upcomingEvents = getUpcomingRytoberfestEvents(events as RyanEvent[]);
  const chapterCount = new Set(
    upcomingEvents.flatMap((event) => event.chapter ?? []),
  ).size;
  const lineupMeta = `${chapterCount} ${chapterCount === 1 ? "chapter" : "chapters"} · ${upcomingEvents.length} ${upcomingEvents.length === 1 ? "celebration" : "celebrations"}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Upcoming Rytoberfest events",
    itemListElement: upcomingEvents.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Event",
        name: event.title,
        description: event.description,
        startDate: typeof event.date === "string" ? event.date : event.dateTime,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: {
          "@type": "Place",
          name: event.venue,
          address: {
            "@type": "PostalAddress",
            addressLocality: event.city,
          },
        },
        url: event.href,
        organizer: {
          "@type": "Organization",
          name: "Ryan Meetup",
          url: "https://ryanmeetup.com",
        },
      },
    })),
  };

  return (
    <Layout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="relative isolate overflow-hidden rounded-[2rem] border border-black/10 bg-[#173b3f] text-white shadow-2xl dark:border-white/15">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(241,160,60,0.35),transparent_34%),linear-gradient(125deg,rgba(9,31,34,0.98)_20%,rgba(23,59,63,0.86)_58%,rgba(23,59,63,0.3))]" />
        <div className="relative grid min-h-[560px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="z-10 flex flex-col justify-center p-6 sm:p-10 lg:p-14 xl:p-16">
            <Pill
              variant="overlay"
              className="mb-6 w-fit border-[#f3b453]/60 bg-[#f3b453]/15 text-[#ffe0a8]"
            >
              No Bryans. Plenty of steins.
            </Pill>
            <Heading
              size="h1"
              ignoreColorMode
              className="max-w-3xl text-5xl leading-[0.95] text-white title sm:text-6xl xl:text-7xl"
            >
              Rytoberfest is brewing.
            </Heading>
            <Text className="mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
              Ryan Meetup chapters are raising a glass across the country. Find
              your local Rytoberfest, bring your best lederhosen, and RSVP
              before the pretzels disappear.
            </Text>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button.Link
                href="#lineup"
                size="md"
                fullWidth
                className="border-[#f3b453] bg-[#f3b453] text-[#173b3f] hover:border-[#ffd185] hover:bg-[#ffd185] sm:w-auto"
                leftIcon={<ArrowDown aria-hidden />}
              >
                Find your Rytoberfest
              </Button.Link>
              <Button.Link
                href="/chapters"
                size="md"
                variant="secondary"
                fullWidth
                className="border-white/25 bg-white/10 text-white hover:border-white/50 hover:bg-white/15 sm:w-auto"
                leftIcon={<Location aria-hidden />}
              >
                Explore chapters
              </Button.Link>
            </div>
          </div>

          <div className="relative min-h-[340px] overflow-hidden lg:min-h-full">
            <NextImage
              src="/group-photos/rytober.jpg"
              alt="Ryans celebrating together at Rytoberfest"
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 45vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#173b3f]/15 via-transparent to-[#173b3f]/60 lg:bg-gradient-to-r lg:from-[#173b3f] lg:via-[#173b3f]/15 lg:to-transparent" />
          </div>
        </div>
      </section>

      <Divider margins="lg" />

      <section
        id="lineup"
        className="scroll-mt-24"
        aria-label="Rytoberfest event lineup"
      >
        {upcomingEvents.length === 0 ? (
          <div className="space-y-5">
            <div className="text-center">
              <Pill variant="subtle">The taps are resting</Pill>
              <Heading size="h2" className="mt-4 text-3xl title sm:text-4xl">
                More Rytoberfests are fermenting
              </Heading>
            </div>
            <EmptyState
              variant="solid"
              message="No upcoming Rytoberfest events are posted yet. Check back soon for chapter announcements."
            />
          </div>
        ) : (
          <UpcomingEventsList
            events={upcomingEvents}
            title="Upcoming Rytoberfests"
            displayMode="details"
            headerMeta={lineupMeta}
          />
        )}
      </section>
    </Layout>
  );
};

export default RytoberfestPage;
