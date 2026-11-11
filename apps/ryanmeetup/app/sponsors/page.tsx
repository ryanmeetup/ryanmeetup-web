// Components
import { Layout } from "@/components/navigation";
import { Blurb, Divider, Text } from "@ryanmeetup/ui";
import { PartnershipPerks, SponsorSection } from "@/components/sponsors";

// Types
import { Sponsor } from "@/lib/types";
import { buildPageMetadata } from "@/utils/metadata";

// Utilities
import { fetchSponsors } from "@/actions/fetchContent";

export async function generateMetadata() {
  const sponsors = await fetchSponsors();

  return buildPageMetadata({
    title: "Ryan Meetup - Sponsors",
    description:
      "Meet the brands and community supporters helping Ryan Meetup bring Ryans together online and in person.",
    canonical: "https://ryanmeetup.com/sponsors",
    image: {
      url: "https://ryanmeetup.com/meta/sponsors.jpg",
      width: 1534,
      height: 763,
    },
    keywords: [
      "ryan meetup",
      ...sponsors.map(
        (sponsor) => (sponsor.name as string)?.toLowerCase() || "",
      ),
      "ryan meetup sponsors",
      "ryan meetup sponsorship",
      "ryan meetup partners",
      "monthly backers",
      "brand collaboration",
      "event sponsorship",
      "recurring sponsorship",
    ],
  });
}

const SponsorsPage = async () => {
  const sponsors = (await fetchSponsors()) as Sponsor[];

  const recurringSponsors = sponsors.filter(
    (sponsor) =>
      sponsor.partnershipType === "Recurring Sponsor" && sponsor.active,
  );
  const featuredBrandPartners = sponsors.filter(
    (sponsor) => sponsor.partnershipType === "Featured Brand Partner",
  );
  const communitySponsors = sponsors.filter(
    (sponsor) => sponsor.partnershipType === "Community Supporter",
  );

  return (
    <Layout className="space-y-12">
      <Blurb
        fullHeadline="Help Power Ryan Meetup"
        smallHeadline="Help Power Ryan Meetup"
        fullHeadlineNode={
          <span className="mx-auto block leading-[0.95]">
            <span className="block">Help Power Ryan Meetup</span>
          </span>
        }
        smallHeadlineNode={
          <span className="mx-auto block max-w-[13ch] leading-[0.95]">
            <span className="block">Help Power</span>
            <span className="block">Ryan Meetup</span>
          </span>
        }
      >
        <div className="space-y-6">
          <Text className="mx-0 text-lg text-black/70 dark:text-white/70 lg:mx-32">
            Ryan Meetup is a growing community with real-world events, internet momentum, and a name brands do not forget. We work with sponsors who want to support the community on a recurring basis or help bring specific events to life.
          </Text>
          <PartnershipPerks detailsHref="/sponsors/partnerships" />
        </div>
      </Blurb>

      <Divider margins="xl" />

      <SponsorSection
        id="current-monthly-backers"
        title="Current Monthly Backers"
        description="The businesses providing ongoing support for Ryan Meetup operations, events, and community growth."
        sponsors={recurringSponsors}
        kicker={false}
        emptyMessage="Monthly Backer spots are open."
      />

      <Divider margins="xl" />

      <SponsorSection
        id="major-brand-collaborations"
        title="Major Brand Collaborations"
        description="Brands we have worked with on notable campaigns, activations, and shared Ryan moments."
        sponsors={featuredBrandPartners}
        sponsorSize="featured"
        emptyMessage="Major brand collaborations will appear here as sponsor entries are updated in Contentful."
      />

      <Divider margins="xl" />

      <SponsorSection
        id="community-event-supporters"
        title="Community & Event Supporters"
        description="Brands and supporters who contributed through event support, in-kind donations, introductions, or other meaningful help."
        sponsors={communitySponsors}
        sponsorSize="compact"
        emptyMessage="Community supporters will appear here as sponsor entries are updated in Contentful."
      />

      <Divider margins="xl" />
    </Layout>
  );
};

export default SponsorsPage;
