// Components
import { Layout } from "@/components/navigation";
import { AnchorNav, Blurb, Divider, Text } from "@ryanmeetup/ui";
import { EventsContainer } from "@/components/events";
import {
  FaRegNewspaper as News,
  FaCalendarAlt as Calendar,
  FaHistory as History,
} from "react-icons/fa";
import { FaUserPlus as Join } from "react-icons/fa6";

// Types
import type { RyanEvent } from "@/lib/types";
import { buildPageMetadata } from "@/utils/metadata";

// Utilities
import { fetchEvents } from "@/actions/fetchContent";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - All Events",
  description: "All Ryan Meetup events in one place.",
  canonical: "https://ryanmeetup.com/events/all",
  image: {
    url: "https://ryanmeetup.com/group-photos/rockies.jpg",
    width: 3490,
    height: 2328,
  },
  keywords: [
    "ryan meetup events",
    "ryan meetup all events",
    "ryan meetup schedule",
    "ryan meetup calendar",
  ],
});

const AllEventsPage = async () => {
  const events = await fetchEvents();
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
      <Blurb
        fullHeadline="All Ryan Meetups"
        smallHeadline="All Events"
        href="/newsletter"
        icon={<News />}
        hrefText="Sign up for emails"
        secondaryHref="/join"
        secondaryIcon={<Join />}
        secondaryHrefText="Follow us on Partiful"
      >
        <Text className="secondary text-xl mb-6 xl:mx-32">
          Everything we&apos;ve got — main events and chapter meetups in one
          place.
        </Text>
      </Blurb>

      <Divider />

      <AnchorNav items={anchors} />

      <EventsContainer
        events={events as unknown as RyanEvent[]}
        showChapters={false}
        displayMode="flat"
        upcomingSectionId="upcoming-events"
        pastSectionId="past-events"
      />
    </Layout>
  );
};

export default AllEventsPage;
