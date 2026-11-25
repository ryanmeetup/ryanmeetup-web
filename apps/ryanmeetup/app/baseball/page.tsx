// Components
import { Layout } from "@/components/navigation";
import {
  AnchorNav,
  Button,
  Divider,
  EmptyState,
  SectionHeader,
} from "@ryanmeetup/ui";
import { buildContactHref } from "@ryanmeetup/contact";
import { FaBaseballBall } from "react-icons/fa";
import { FaShirt } from "react-icons/fa6";
import { FiGift, FiHelpCircle, FiMap } from "react-icons/fi";
import {
  BaseballHero,
  MerchStrip,
  NightIncludes,
  TeamFinder,
  TeamLogoMarquee,
} from "@/components/baseball";

// Types
import type { BaseballTeam } from "@/lib/types";
import type { MerchCollection } from "@/actions/fetchShopify";
import type { MerchPlaceholder } from "@/components/baseball";

// Utilities
import { fetchBaseballTeams } from "@/actions/fetchContent";
import { fetchMerchCollection } from "@/actions/fetchShopify";
import {
  getBaseballFixtures,
  getBaseballMerchFixture,
} from "@/lib/test-fixtures/baseball";
import { getSeasonRange } from "@/utils/baseball";
import { buildPageMetadata, SITE_URL } from "@/utils/metadata";
import { layoutPaddingX } from "@/lib/constants";
import { STORE_URL } from "@/lib/store";

const MERCH_COLLECTION_HANDLE = "baseball-classic";

// Reserved tiles shown until the `baseball-classic` Shopify collection has
// products; real products replace them automatically. Point each `href` at a
// product page (`${STORE_URL}/products/<handle>`) once it exists. They go to
// the store home for now because the collection page 404s until it's created.
const MERCH_PLACEHOLDERS: MerchPlaceholder[] = [1, 2, 3, 4].map((slot) => ({
  id: `merch-slot-${slot}`,
  title: "Classic merch",
  href: STORE_URL,
}));

// Unlisted until launch: reachable by URL, but noindexed and left out of the
// sitemap and navigation. To launch, drop `robots` here, add "/baseball" to
// app/sitemap.ts and tests/pages.spec.ts, and link it from the nav.
export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Ryan Baseball Classic",
  description:
    "Find a Ryan Baseball Classic game near you, get tickets, and gear up with Classic merch.",
  canonical: `${SITE_URL}/baseball`,
  image: {
    url: `${SITE_URL}/meta/baseball.png`,
    width: 944,
    height: 521,
    alt: "Map of Ryan Baseball Classic teams across the United States and Canada",
  },
  keywords: ["ryan baseball classic", "ryan meetup baseball", "ryan night"],
  robots: {
    index: false,
    follow: false,
  },
});

const loadTeams = async (): Promise<BaseballTeam[]> => {
  if (process.env.E2E_TESTS === "true") return getBaseballFixtures();

  try {
    return (await fetchBaseballTeams()) as unknown as BaseballTeam[];
  } catch (error) {
    // Until the `baseballTeam` content type exists, Contentful rejects the
    // query; show the "coming soon" state rather than failing the page.
    console.error("Unable to load Baseball Classic teams", error);
    return [];
  }
};

const loadMerch = async (): Promise<MerchCollection | null> => {
  if (process.env.E2E_TESTS === "true") return getBaseballMerchFixture();
  return fetchMerchCollection(MERCH_COLLECTION_HANDLE);
};

const BaseballPage = async () => {
  const [teams, merch] = await Promise.all([loadTeams(), loadMerch()]);
  const iconStyle = "h-5 w-5";
  const anchors = [
    {
      icon: <FaBaseballBall className={iconStyle} aria-hidden />,
      href: "#find",
      tooltip: "Find your game",
    },
    ...(teams.length > 0
      ? [
          {
            icon: <FiMap className={iconStyle} aria-hidden />,
            href: "#map",
            tooltip: "Team map",
          },
        ]
      : []),
    {
      icon: <FiGift className={iconStyle} aria-hidden />,
      href: "#includes",
      tooltip: "Night details",
    },
    {
      icon: <FaShirt className={iconStyle} aria-hidden />,
      href: "#merch",
      tooltip: "Classic merch",
    },
    {
      icon: <FiHelpCircle className={iconStyle} aria-hidden />,
      href: "#questions",
      tooltip: "Questions",
    },
  ];

  return (
    // Full-bleed like the home page, so the team logos can run edge to edge;
    // every other section brings its own layout padding.
    <Layout fullscreen>
      <AnchorNav items={anchors} />

      <div className="space-y-8 pt-8">
        <div className={layoutPaddingX}>
          <BaseballHero
            teams={teams}
            hasMap={teams.length > 0}
            seasonRange={getSeasonRange(teams)}
          />
        </div>
        <TeamLogoMarquee teams={teams} />
      </div>

      <div className={`space-y-12 pb-8 pt-12 ${layoutPaddingX}`}>
        {teams.length > 0 ? (
          <TeamFinder teams={teams} />
        ) : (
          <section id="find" className="scroll-mt-28 space-y-6">
            <SectionHeader title="Find your Ryan Meetup" />
            <EmptyState message="Teams are still warming up. Check back soon." />
          </section>
        )}

        <NightIncludes />

        <MerchStrip
          collection={merch}
          fallbackHref={STORE_URL}
          placeholders={MERCH_PLACEHOLDERS}
        />

        <Divider margins="lg" />

        <section
          id="questions"
          className="flex scroll-mt-28 flex-col items-center gap-4 text-center"
        >
          <SectionHeader
            align="center"
            title="Got a question?"
            description="Tickets, outings for a group of Ryans, or partnering as a baseball team: send it our way and a Ryan will get back to you."
          />
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button.Link
              href="/contact?topic=baseball-classic"
              size="md"
              fullWidth
              className="sm:w-auto"
            >
              Ask a question
            </Button.Link>
            <Button.Link
              href={buildContactHref("baseball-classic", {
                detail: "team-partner",
                source: "baseball",
              })}
              variant="secondary"
              size="md"
              fullWidth
              className="sm:w-auto"
            >
              Partner as a baseball team
            </Button.Link>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default BaseballPage;
