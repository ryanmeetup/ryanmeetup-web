// Components
import { Layout } from "@/components/navigation";
import { AnchorNav } from "@/components/global";
import { Blurb, Divider, Text } from "@ryanmeetup/ui";
import { EventsContainer } from "@/components/events";
import {
  FaRegNewspaper as News,
  FaListUl as List,
  FaCalendarAlt as Calendar,
  FaHistory as History,
} from "react-icons/fa";
import { FaUserPlus as Join } from "react-icons/fa6";
import NextLink from "next/link";

// Types
import type { RyanEvent } from "@/lib/types";
import { buildPageMetadata } from "@/utils/metadata";

// Utilities
import { fetchEvents } from "@/actions/fetchContent";
import { getTestEvents } from "@/lib/test-fixtures/events";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Events",
  description: "Keep up to date with Ryan Meetups near you!",
  canonical: "https://ryanmeetup.com/events",
  image: {
    url: "https://ryanmeetup.com/group-photos/rockies.jpg",
    width: 3490,
    height: 2328,
  },
  keywords: [
    "when is the next ryan meetup?",
    "ryan meetup",
    "ryan meetup nyc",
    "ryan meetup new york",
    "ryan meetup new york city",
    "ryan meetup near me",
    "ryan meetup los angeles",
    "ryan rendezvous",
    "ryan roundup",
    "ryan kickoff",
    "ryan rodeo",
    "ryan roundtable",
    "ryan roadtrip",
    "ryan rally",
    "ryan rave",
    "ryan run",
    "ryan new york city",
    "ryan meet up",
    "ryan meetup new york city",
    "ryan reunion",
    "ryan syndicate",
    "ryan retreat",
    "ryan relay",
    "st ryans day",
    "ryami vice",
    "150 deadpools and wolverine",
    "ryans game show",
    "rytoberfest",
    "ryancon",
    "last ryan standing",
    "ryan royale",
    "ryan relay",
    "society of ryans",
    "ryan red carpet",
    "ryan meetup schedule",
    "ryan meetup calendar",
    "ryan meetup upcoming events",
  ],
});

const EventsPage = async ({
  searchParams,
}: {
  searchParams?: Promise<{ fixture?: string }>;
}) => {
  const resolvedSearchParams = await searchParams;
  const events =
    process.env.E2E_TESTS === "true"
      ? getTestEvents(resolvedSearchParams?.fixture)
      : await fetchEvents();

  const eventSchema = (events as RyanEvent[]).map((event) => ({
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
    image: [],
    url: event.href,
    organizer: {
      "@type": "Organization",
      name: "Ryan Meetup",
      url: "https://ryanmeetup.com",
    },
  }));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: eventSchema.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: event,
    })),
  };

  const anchors = [
    {
      icon: <Calendar className="h-5 w-5" />,
      href: "#upcoming-events",
      tooltip: "Upcoming Events",
    },
    {
      icon: <History className="h-5 w-5" />,
      href: "#past-events",
      tooltip: "Past Events",
    },
  ];

  return (
    <Layout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Blurb
        fullHeadline="Join the Ryan Meetup"
        smallHeadline="Our Events"
        href="/newsletter"
        icon={<News />}
        hrefText="Sign up for emails"
        secondaryHref="/join"
        secondaryIcon={<Join />}
        secondaryHrefText="Follow us on Partiful"
      >
        <Text className="secondary text-xl mb-6 xl:mx-32">
          <span className="hidden md:inline-block">
            It&apos;s never too late to join the Ryan Meetup.
          </span>
          <span>
            {" "}
            Sign up for our newsletter below to stay up-to-date with our
            events.{" "}
          </span>

          <span className="hidden md:inline-block">
            And remember - No Bryans allowed.
          </span>
        </Text>
      </Blurb>

      <Divider />

      <AnchorNav items={anchors} />

      <EventsContainer
        events={events as unknown as RyanEvent[]}
        showUpcomingSection
        upcomingSectionId="upcoming-events"
        pastSectionId="past-events"
        upcomingHeaderAction={
          <NextLink
            href="/events/upcoming"
            className="inline-flex items-center gap-2 rounded-full border border-black/70 bg-black px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:border-black/90 hover:bg-black/90 dark:border-white/60 dark:bg-white dark:text-black dark:hover:border-white/80 dark:hover:bg-white/90"
          >
            <List className="h-3 w-3" />
            See all upcoming
          </NextLink>
        }
      />
    </Layout>
  );
};

export default EventsPage;
