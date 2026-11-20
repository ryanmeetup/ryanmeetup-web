// Components
import { Layout } from "@/components/navigation";
import { Button, Divider, EmptyState, SectionHeader } from "@ryanmeetup/ui";
import { BaseballHero, MerchStrip, TeamFinder } from "@/components/baseball";

// Types
import type { BaseballTeam } from "@/lib/types";
import type { MerchCollection } from "@/actions/fetchShopify";

// Utilities
import { fetchBaseballTeams } from "@/actions/fetchContent";
import { fetchMerchCollection } from "@/actions/fetchShopify";
import {
  getBaseballFixtures,
  getBaseballMerchFixture,
} from "@/lib/test-fixtures/baseball";
import { getSeasonRange } from "@/utils/baseball";
import { buildPageMetadata, SITE_URL } from "@/utils/metadata";

const MERCH_COLLECTION_HANDLE = "baseball-classic";

// Unlisted until launch: reachable by URL, but noindexed and left out of the
// sitemap and navigation. To launch, drop `robots` here, add "/baseball" to
// app/sitemap.ts and tests/pages.spec.ts, and link it from the nav.
export const metadata = buildPageMetadata({
  title: "Ryan Meetup - Ryan Baseball Classic",
  description:
    "Find a Ryan Baseball Classic game near you, get tickets, and gear up with Classic merch.",
  canonical: `${SITE_URL}/baseball`,
  image: {
    url: `${SITE_URL}/meta/map.png`,
    width: 1355,
    height: 692,
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
  const hasMerch = Boolean(merch && merch.products.length > 0);

  return (
    <Layout>
      <div className="space-y-12">
        <BaseballHero
          teams={teams}
          seasonRange={getSeasonRange(teams)}
          hasMerch={hasMerch}
        />

        {merch && hasMerch && <MerchStrip collection={merch} />}

        {teams.length > 0 ? (
          <TeamFinder teams={teams} />
        ) : (
          <section id="find" className="space-y-6">
            <SectionHeader title="Find your Ryan night" />
            <EmptyState message="Teams are still warming up. Check back soon." />
          </section>
        )}
      </div>

      <Divider margins="lg" />

      <section className="flex flex-col items-center gap-4 text-center">
        <SectionHeader
          align="center"
          title="Got a question?"
          description="Tickets, group outings, or bringing your team into the Classic: send it our way and a Ryan will get back to you."
        />
        <Button.Link
          href="/contact?topic=baseball-classic"
          size="md"
          fullWidth
          className="sm:w-auto"
        >
          Ask a question
        </Button.Link>
      </section>
    </Layout>
  );
};

export default BaseballPage;
