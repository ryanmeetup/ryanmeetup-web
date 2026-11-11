// Components
import { Layout } from "@/components/navigation";
import { AnchorNav } from "@/components/global";
import { Divider, Heading, Text } from "@ryanmeetup/ui";
import {
  FarthestRyan,
  Champion,
  CollapsibleSection,
  Leaderboard,
} from "@/components/awards";
import NextLink from "next/link";
import { MdLeaderboard as Leader } from "react-icons/md";
import { FaTrophy as Trophy, FaPlaneArrival as Plane } from "react-icons/fa";

// Types
import type { TravelingRyan, ChampionRyan, RepeatRyan } from "@/lib/types";
import { buildPageMetadata } from "@/utils/metadata";

// Utilities
import {
  fetchFarthestRyans,
  fetchChampionRyans,
  fetchRepeatRyans,
  fetchEventTimeline,
} from "@/actions/fetchContent";
import { getAwardsFixture } from "@/lib/test-fixtures/awards";
import { contactHrefs } from "@/utils/contact";
import { MIN_EVENTS_TO_QUALIFY } from "@/utils/streaks";

export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Awards",
  description:
    "The Hall of Ryans honors farthest traveling Ryans, Ryan Meetup champions, and more.",
  canonical: "https://ryanmeetup.com/awards",
  siteName: "Ryan Meetup - Awards",
  image: {
    url: "https://ryanmeetup.com/trophy.png",
    width: 1000,
    height: 667,
  },
  keywords: [
    "award winners",
    "hall of ryans",
    "farthest traveling ryans",
    "who won at the ryan meetup",
    "ryan meetup tournament",
    "rytoberfest champion",
    "little kings",
    "little king of St. Ryans Day",
    "mr ryami",
    "ms. ryami",
    "ryan meetup awards",
    "ryan meetup winners",
    "ryan meetup leaderboard",
  ],
});

const AwardsPage = async () => {
  const fixture = process.env.E2E_TESTS === "true" ? getAwardsFixture() : null;
  const farthest = fixture?.farthest ?? (await fetchFarthestRyans());
  const champs = fixture?.champs ?? (await fetchChampionRyans());
  const repeats = fixture?.repeats ?? (await fetchRepeatRyans());
  const timeline = fixture?.timeline ?? (await fetchEventTimeline());

  const iconStyle = "h-5 w-5";

  const anchors = [
    {
      icon: <Plane className={iconStyle} />,
      href: "#farthest",
      tooltip: "Farthest Traveled",
    },
    {
      icon: <Trophy className={iconStyle} />,
      href: "#champions",
      tooltip: "Champions",
    },
    {
      icon: <Leader className={iconStyle} />,
      href: "#leaderboard",
      tooltip: "Leaderboard",
    },
  ];

  return (
    <Layout>
      <div className="relative space-y-12">
        <section className="space-y-4 text-center">
          <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h1">
            Hall of Ryans
          </Heading>
          <Text className="text-lg text-black/70 dark:text-white/70">
            Honoring the Ryans who traveled the farthest, earned top titles, and
            showed up again and again.
          </Text>
        </section>

        <AnchorNav items={anchors} />

        <Divider margins="xl" />

        <CollapsibleSection id="farthest" title="Farthest Traveling Ryans">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {farthest?.map((ryan, index) => (
              <FarthestRyan
                key={index}
                ryan={ryan as unknown as TravelingRyan}
              />
            ))}
          </div>
        </CollapsibleSection>

        <Divider margins="xl" />

        <CollapsibleSection
          id="champions"
          title="Ryan Meetup Champions"
          description={
            <Text className="text-base text-black/70 dark:text-white/70">
              Ryans that overcame great obstacles to take home the championship
              titles.
            </Text>
          }
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {champs?.map((ryan, index) => (
              <Champion key={index} ryan={ryan as unknown as ChampionRyan} />
            ))}
          </div>
        </CollapsibleSection>

        <Divider margins="xl" />

        <CollapsibleSection
          id="leaderboard"
          title="Attendance Leaderboard"
          description={
            <Text className="text-sm text-black/70 dark:text-white/70">
              <span className="font-semibold text-blue-700 dark:text-blue-500">
                *
              </span>
              Ryans must attend at least {MIN_EVENTS_TO_QUALIFY} Ryan Meetups to
              qualify. Longest streak is a Ryan&apos;s best run of consecutive
              Ryan Meetups, not their current one. Tap a column heading to sort.
            </Text>
          }
        >
          <Leaderboard ryans={repeats as RepeatRyan[]} timeline={timeline} />

          <div className="space-y-2 pt-10 pb-16 text-center">
            <Heading className="text-3xl title sm:text-4xl">
              Not seeing your name?
            </Heading>
            <Text className="text-base text-black/70 dark:text-white/70">
              Send the details through our prefilled{" "}
              <NextLink
                href={contactHrefs.awardsCorrection}
                className="font-semibold text-blue-700 dark:text-blue-500 hover:cursor"
              >
                /contact
              </NextLink>{" "}
              form.
            </Text>
          </div>
        </CollapsibleSection>
      </div>
    </Layout>
  );
};

export default AwardsPage;
