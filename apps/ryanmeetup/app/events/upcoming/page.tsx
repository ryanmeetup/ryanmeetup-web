// Components
import { Layout } from "@/components/navigation";
import { Breadcrumbs } from "@/components/global";
import { Blurb, Divider, Text } from "@ryanmeetup/ui";
import { EventsListPager } from "@/components/events/EventsListPager";
import { FaListUl as List } from "react-icons/fa";

// Types
import type { RyanEvent } from "@/lib/types";

// Utilities
import { fetchEvents } from "@/actions/fetchContent";
import { getTestEvents } from "@/lib/test-fixtures/events";
import { buildPageMetadata } from "@/utils/metadata";
import { IoCalendarNumber as Calendar } from "react-icons/io5";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Upcoming Events",
  description: "See upcoming Ryan Meetups.",
  canonical: "https://ryanmeetup.com/events/upcoming",
  image: {
    url: "https://ryanmeetup.com/group-photos/rockies.jpg",
    width: 3490,
    height: 2328,
  },
});

const UpcomingPage = async ({
  searchParams,
}: {
  searchParams?: Promise<{ fixture?: string }>;
}) => {
  const resolvedSearchParams = await searchParams;
  const events =
    process.env.E2E_TESTS === "true"
      ? getTestEvents(resolvedSearchParams?.fixture)
      : await fetchEvents();

  const iconStyle = "mr-2 fill-black h-4 w-4 shrink-0 dark:fill-white";
  const breadcrumbs = [
    {
      icon: <Calendar className={iconStyle} />,
      href: "/events",
      title: "Events",
    },
    {
      icon: <List className={iconStyle} />,
      href: "/events/upcoming",
      title: "Upcoming",
    },
  ];

  return (
    <Layout>
      <Blurb fullHeadline="Upcoming Events">
        <Text className="secondary text-xl mb-6 xl:mx-40">
          Browse upcoming Ryan Meetups and join in on the fun.
        </Text>
      </Blurb>

      <Divider />

      <EventsListPager
        events={events as RyanEvent[]}
        view="upcoming"
        perPageOptions={[5, 10, 25]}
        defaultPerPage={10}
        breadcrumbNode={<Breadcrumbs className="flex" crumbs={breadcrumbs} />}
        listTitle="Upcoming Events"
        ctaLabel="RSVP"
        sortOrder="asc"
        emptyStateVariant="table"
        showDisplayModeSwitch
      />
    </Layout>
  );
};

export default UpcomingPage;
