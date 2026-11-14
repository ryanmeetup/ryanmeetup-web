// Components
import { Layout } from "@/components/navigation";
import { Blurb, Divider, Text } from "@ryanmeetup/ui";
import { SponsorSection } from "@/components/sponsors";
import { PartnershipPerks } from "@ryanmeetup/sponsors";
import type { PartnershipPerk } from "@ryanmeetup/sponsors";
import { BiMailSend as Send } from "react-icons/bi";
import { GoSponsorTiers as SponsorDetails } from "react-icons/go";

// Types
import type { Sponsor } from "@/lib/types";

// Utilities
import { fetchSponsors } from "@/actions/fetchContent";
import { contactHrefs } from "@/utils/contact";

const partnershipPerks: PartnershipPerk[] = [
  { text: "Logo placement across RyanCon web, event, and promotional materials." },
  { text: "On-site booths, branded experiences, and memorable attendee activations." },
  { text: "Custom partnership opportunities aligned with your brand and goals." },
  { text: "Visibility through RyanCon and Ryan Meetup social storytelling." },
  { text: "Inclusion in event recaps and content that extends beyond RyanCon itself." },
  { text: "Stage recognition and sponsor mentions when the program format fits." },
];

const SponsorsPage = async () => {
  const sponsors = (await fetchSponsors()) as Sponsor[];

  const foundingSponsors = sponsors.filter(
    (sponsor) => sponsor.eventsSponsored >= 3,
  );
  const coreSponsors = sponsors.filter(
    (sponsor) => sponsor.eventsSponsored === 2,
  );
  const contributingSponsors = sponsors.filter(
    (sponsor) => sponsor.eventsSponsored <= 1,
  );

  return (
    <Layout className="space-y-12">
      <Blurb
        fullHeadline="Help Power RyanCon"
        smallHeadline="Help Power RyanCon"
        fullHeadlineNode={
          <span className="mx-auto block leading-[0.95]">
            <span className="block">Help Power RyanCon</span>
          </span>
        }
        smallHeadlineNode={
          <span className="mx-auto block max-w-[13ch] leading-[0.95]">
            <span className="block">Help Power</span>
            <span className="block">RyanCon</span>
          </span>
        }
      >
        <div className="space-y-6">
          <Text className="mx-0 text-lg text-black/70 dark:text-white/70 lg:mx-32">
            RyanCon brings the Ryan community together for one unforgettable
            flagship event. We work with sponsors who want to help make the
            experience possible while connecting their brand with an engaged,
            highly shareable community.
          </Text>
          <PartnershipPerks
            perks={partnershipPerks}
            intro="RyanCon sponsor opportunities may include"
            details={{
              href: "/sponsorship",
              label: "View sponsorship details",
              icon: <SponsorDetails className="h-4 w-4" />,
            }}
            contact={{
              href: contactHrefs.sponsorship,
              label: "Partner with RyanCon",
              icon: <Send className="h-4 w-4" />,
            }}
          />
        </div>
      </Blurb>

      <Divider margins="xl" />

      <SponsorSection
        id="founding-sponsors"
        title="Founding Sponsors"
        description="Flagship partners whose sustained support helps build RyanCon from the ground up."
        sponsors={foundingSponsors}
        emptyMessage="Founding sponsorship opportunities are now open."
      />

      <Divider margins="xl" />

      <SponsorSection
        id="core-sponsors"
        title="Core Sponsors"
        description="Major partners helping bring the RyanCon experience, programming, and activations to life."
        sponsors={coreSponsors}
        sponsorSize="featured"
        emptyMessage="Core sponsorship opportunities are now open."
      />

      <Divider margins="xl" />

      <SponsorSection
        id="contributing-sponsors"
        title="Contributing Sponsors"
        description="Partners supporting RyanCon through event funding, in-kind contributions, and community resources."
        sponsors={contributingSponsors}
        sponsorSize="compact"
        emptyMessage="Contributing sponsorship opportunities are now open."
      />

      <Divider margins="xl" />
    </Layout>
  );
};

export default SponsorsPage;
