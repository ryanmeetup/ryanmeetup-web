import {
  Breadcrumbs,
  Button,
  Card,
  Divider,
  Heading,
  IconBadge,
  Kicker,
  Text,
} from "@ryanmeetup/ui";
import { permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import { BiMailSend as Send } from "react-icons/bi";
import {
  FaBullhorn as Megaphone,
  FaCalendarAlt as Calendar,
  FaInfoCircle as Details,
  FaGlobeAmericas as Website,
  FaInstagram as Instagram,
  FaMapMarkedAlt as Footprint,
  FaNewspaper as Press,
  FaRegLightbulb as Idea,
  FaTshirt as Signage,
  FaVideo as Video,
} from "react-icons/fa";
import { GoSponsorTiers as SponsorsIcon } from "react-icons/go";

import { Layout } from "@/components/navigation";
import {
  MonthlyBackerTiers,
  PartnershipInquiryForm,
  ReachSnapshot,
} from "@/components/sponsors";
import {
  monthlyBackerTiers,
  scopedCollaborationTypes,
  MONTHLY_BACKERS_ANCHOR,
} from "@/lib/sponsorship-program";
import type { CollaborationTypeSlug } from "@/lib/sponsorship-program";
import { buildPageMetadata } from "@/utils/metadata";

export const partnershipMetadata = buildPageMetadata({
  title: "Ryan Meetup - Brand Collaborations & Event Sponsorships",
  description:
    "Bring Ryan Meetup a brand idea and we will scope it together—event sponsorships and custom brand collaborations.",
  canonical: "https://ryanmeetup.com/sponsors/partnerships",
  image: {
    url: "https://ryanmeetup.com/meta/sponsors.jpg",
    width: 1534,
    height: 763,
  },
  keywords: [
    "ryan meetup brand collaboration",
    "ryan meetup partnerships",
    "ryan meetup event sponsorship",
    "event sponsor",
    "brand activation",
    "community event sponsorship",
  ],
});

const breadcrumbIconStyle = "mr-2 fill-black h-4 w-4 shrink-0 dark:fill-white";

const lowestMonthlyBackerPrice = Math.min(
  ...monthlyBackerTiers.map((tier) => tier.price),
);

const collaborationIcons: Record<CollaborationTypeSlug, ReactNode> = {
  "event-sponsorship": <Calendar className="h-4 w-4" />,
  "brand-collaboration": <Idea className="h-4 w-4" />,
  "not-sure": <Details className="h-4 w-4" />,
};

const opportunityAreas = [
  {
    icon: <Signage className="h-4 w-4" />,
    title: "On-site Visibility",
    description:
      "Physical signage, branded materials, giveaways, or merchandise when they support the event experience.",
  },
  {
    icon: <Video className="h-4 w-4" />,
    title: "Shareable Content",
    description:
      "Integration into event storytelling, recap video, or a larger digital media push built around the concept.",
  },
  {
    icon: <Instagram className="h-4 w-4" />,
    title: "Social Visibility",
    description:
      "Campaign-specific Instagram or TikTok inclusion scoped around the audience, format, and creative fit.",
  },
  {
    icon: <Press className="h-4 w-4" />,
    title: "Press Storytelling",
    description:
      "Press release inclusion and media-story support when the activation has a strong public-interest angle.",
  },
  {
    icon: <Website className="h-4 w-4" />,
    title: "RyanMeetup.com",
    description:
      "A visible campaign or sponsor presence across the parts of RyanMeetup.com included in the final scope.",
  },
  {
    icon: <Footprint className="h-4 w-4" />,
    title: "Local Relevance",
    description:
      "City, chapter, or regional alignment when a brand wants to meet Ryans in a particular market.",
  },
] as const;

const nextSteps = [
  {
    title: "Share the idea",
    body: "Tell us the brand, the idea, the goal behind it, and your timing. No budget gate and no fixed rate card to squeeze into.",
  },
  {
    title: "Scope the fit",
    body: "A Ryan reviews the brief and, when the fit is strong, works with your team on the activation, the deliverables, and what it should cost.",
  },
  {
    title: "Confirm the partnership",
    body: "We align on the final scope, agreement, payment schedule, production needs, and measurement plan.",
  },
  {
    title: "Bring it to life",
    body: "Both teams execute the agreed plan without turning the Ryan community into an advertising feed.",
  },
] as const;

const partnershipBoundaries = [
  {
    title: "No inbox takeovers",
    body: "We do not sell dedicated sponsor email blasts or turn the newsletter into a standalone ad.",
  },
  {
    title: "No paid access to the community",
    body: "We do not sell Discord access, member lists, contact information, or permission to cold-message Ryans.",
  },
  {
    title: "No unfiltered sales pitches",
    body: "We do not hand over the mic, the feed, or an event agenda for a brand to run an unrelated pitch.",
  },
  {
    title: "No pay-to-praise coverage",
    body: "A partnership does not buy editorial control, guaranteed positive coverage, or a testimonial we do not believe.",
  },
] as const;

const PartnershipsPage = () => (
  <Layout className="space-y-12">
    <div className="flex flex-wrap gap-y-8">
      <aside
        className="w-full xl:w-4/12 xl:pr-6"
        aria-label="Sponsorship options"
      >
        <div className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <Card variant="soft" size="lg" className="space-y-6">
            <div className="space-y-2">
              <Heading className="text-3xl title sm:text-4xl" size="h2">
                Sponsorship Options
              </Heading>
              <Text className="text-sm text-black/70 dark:text-white/70">
                Two ways in: published pricing, or built from scratch.
              </Text>
            </div>

            <div className="rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="space-y-4 border-b border-black/10 px-5 py-5 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <IconBadge>
                    <Megaphone className="h-4 w-4" />
                  </IconBadge>
                  <Heading className="text-2xl title" size="h3">
                    Monthly Backers
                  </Heading>
                </div>
                <div className="space-y-1">
                  <Kicker>Starting at</Kicker>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold leading-none title">
                      ${lowestMonthlyBackerPrice}
                    </span>
                    <span className="text-base font-semibold text-black/60 dark:text-white/60">
                      /month
                    </span>
                  </p>
                </div>
                <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
                  Recurring visibility on published tiers. No application,
                  nothing to scope.
                </Text>
                <Button.Link
                  href={MONTHLY_BACKERS_ANCHOR}
                  variant="secondary"
                  size="sm"
                  fullWidth
                  newTab={false}
                >
                  See all three tiers
                </Button.Link>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="flex items-center gap-3">
                  <IconBadge>
                    <Calendar className="h-4 w-4" />
                  </IconBadge>
                  <Heading className="text-2xl title" size="h3">
                    Brand Collaborations
                  </Heading>
                </div>
                <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
                  A campaign-specific partnership for a Ryan Meetup event or
                  custom concept. You bring the idea, we build it with you.
                </Text>
                <Button.Link
                  href="#collaboration-formats"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  newTab={false}
                >
                  Compare the formats
                </Button.Link>
              </div>
            </div>

            <Divider />

            <div className="space-y-3">
              <Heading className="text-2xl title" size="h3">
                Ready to talk?
              </Heading>
              <Text className="text-sm text-black/70 dark:text-white/70">
                Tell us the brand, the idea, and your timing. A Ryan reads every
                brief and we scope the fit from there—no budget gate, no rate
                card to squeeze into.
              </Text>
              <Button.Link
                href="#partnership-intake"
                leftIcon={<Send className="h-4 w-4" />}
                variant="primary"
                size="md"
                fullWidth
                newTab={false}
              >
                Start the conversation
              </Button.Link>
              <Text className="text-xs text-black/60 dark:text-white/60">
                Sponsoring an event is the usual route, but a strong idea can
                become its own format. If you just want to support the Ryans,
                Monthly Backers is the simpler path.
              </Text>
            </div>
          </Card>
        </div>
      </aside>

      <div className="w-full xl:w-8/12 xl:pl-6">
        <Breadcrumbs
          className="mb-1"
          crumbs={[
            {
              icon: <SponsorsIcon className={breadcrumbIconStyle} />,
              href: "/sponsors",
              title: "Sponsors",
            },
            {
              icon: <Details className={breadcrumbIconStyle} />,
              href: "/sponsors/partnerships",
              title: "Sponsorship Details",
            },
          ]}
        />

        <div className="space-y-12">
          <section className="space-y-5" aria-labelledby="partnerships-heading">
            <div className="space-y-3">
              <Heading
                id="partnerships-heading"
                className="text-4xl leading-[0.95] title sm:text-5xl lg:text-6xl"
                size="h1"
              >
                Work with Ryan Meetup
              </Heading>
              <Text className="text-lg text-black/70 dark:text-white/70">
                Brand collaborations are built with you, not sold off a rate
                card. Bring us the Ryan moment you want to make—an event
                sponsorship or an idea that needs its own format—and we will
                scope it and price it together.
              </Text>
            </div>
          </section>

          <Divider margins="lg" />

          <MonthlyBackerTiers />

          <Divider margins="lg" />

          <section className="space-y-6" aria-labelledby="proof-heading">
            <div className="space-y-3">
              <Heading
                id="proof-heading"
                className="text-3xl title sm:text-4xl lg:text-5xl"
                size="h2"
              >
                Why this makes sense for your brand
              </Heading>
              <Text className="text-base text-black/70 dark:text-white/70">
                Ryan Meetup combines audience reach, in-person turnout, and a
                growing local footprint rather than a single isolated placement.
                For brands looking beyond standard corporate sponsorship
                inventory, our distinct voice and internet presence can create a
                more memorable kind of visibility.
              </Text>
            </div>
            <ReachSnapshot />
          </section>

          <Divider margins="lg" />

          <section
            id="partnership-intake"
            className="scroll-mt-28 space-y-6"
            aria-labelledby="partnership-intake-heading"
          >
            <div className="space-y-3">
              <Heading
                id="partnership-intake-heading"
                className="text-3xl title sm:text-4xl lg:text-5xl"
                size="h2"
              >
                Tell us what the brand wants to accomplish
              </Heading>
              <Text className="text-base text-black/70 dark:text-white/70">
                There is no budget gate and no minimum to clear. Tell us what
                you want to build and we will figure out the scope and the
                pricing together. If you would rather just support the Ryans,
                Monthly Backers is the simpler path.
              </Text>
              <Button.Link
                href={MONTHLY_BACKERS_ANCHOR}
                variant="secondary"
                size="sm"
                newTab={false}
                className="w-full sm:w-auto"
              >
                Explore Monthly Backers
              </Button.Link>
            </div>

            <Card variant="solid" size="lg">
              <PartnershipInquiryForm />
            </Card>
          </section>

          <Divider margins="lg" />

          <section
            id="collaboration-formats"
            className="@container scroll-mt-28 space-y-6"
            aria-labelledby="collaboration-formats-heading"
          >
            <div className="space-y-3">
              <Heading
                id="collaboration-formats-heading"
                className="text-3xl title sm:text-4xl lg:text-5xl"
                size="h2"
              >
                What are we building?
              </Heading>
              <Text className="text-base text-black/70 dark:text-white/70">
                Event sponsorships put your brand in the room where Ryans
                actually gather, from national events to local chapter meetups.
                Custom collaborations give a strong idea room to become
                something else entirely.
              </Text>
            </div>

            <div className="grid gap-4 @xl:grid-cols-2">
              {scopedCollaborationTypes.map((type) => (
                <Card
                  key={type.slug}
                  variant="soft"
                  size="lg"
                  className="flex h-full flex-col gap-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <IconBadge>{collaborationIcons[type.slug]}</IconBadge>
                      <Heading className="text-2xl title" size="h3">
                        {type.name}
                      </Heading>
                    </div>
                    <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
                      {type.description}
                    </Text>
                  </div>

                  <div className="grow space-y-3 border-t border-black/10 pt-5 dark:border-white/10">
                    <Kicker>Typically includes</Kicker>
                    <ul className="space-y-3">
                      {type.typicallyIncludes.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 text-sm leading-6 text-black/70 dark:text-white/70"
                        >
                          <span
                            aria-hidden
                            className="mt-2 h-2 w-2 shrink-0 rounded-full bg-black/65 dark:bg-white/65"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-black/10 pt-4 dark:border-white/10">
                    <Kicker>Best for</Kicker>
                    <Text className="mt-2 text-sm text-black/70 dark:text-white/70">
                      {type.bestFor}
                    </Text>
                  </div>
                </Card>
              ))}
            </div>

            <Text className="text-sm text-black/60 dark:text-white/60">
              Not sure which one fits? Pick &ldquo;Not sure yet&rdquo; in the{" "}
              <a
                className="underline underline-offset-4"
                href="#partnership-intake"
              >
                intake above
              </a>{" "}
              and we will work it out with you.
            </Text>
          </section>

          <Divider margins="lg" />

          <section
            className="space-y-6"
            aria-labelledby="possibilities-heading"
          >
            <div className="space-y-3">
              <Heading
                id="possibilities-heading"
                className="text-3xl title sm:text-4xl lg:text-5xl"
                size="h2"
              >
                Scope the pieces that serve the idea
              </Heading>
              <Text className="text-base text-black/70 dark:text-white/70">
                These are possibilities, not a promise that every campaign
                includes everything. The final package depends on the format,
                timeline, audience, and brand goals.
              </Text>
            </div>

            <div className="columns-1 gap-4 md:columns-2">
              {opportunityAreas.map((area) => (
                <Card
                  key={area.title}
                  variant="soft"
                  size="lg"
                  className="mb-4 break-inside-avoid space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <IconBadge>{area.icon}</IconBadge>
                    <Heading className="text-2xl title" size="h3">
                      {area.title}
                    </Heading>
                  </div>
                  <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
                    {area.description}
                  </Text>
                </Card>
              ))}
            </div>
          </section>

          <Divider margins="lg" />

          <section className="space-y-6" aria-labelledby="next-steps-heading">
            <div className="space-y-3">
              <Heading
                id="next-steps-heading"
                className="text-3xl title sm:text-4xl lg:text-5xl"
                size="h2"
              >
                What happens next
              </Heading>
            </div>

            <Card variant="solid" size="lg" className="space-y-0">
              {nextSteps.map((step, index) => (
                <div
                  key={step.title}
                  className={`flex gap-4 ${
                    index < nextSteps.length - 1 ? "pb-6" : ""
                  }`}
                >
                  <div className="flex w-16 shrink-0 flex-col items-center">
                    <IconBadge size="lg">{index + 1}</IconBadge>
                    {index < nextSteps.length - 1 && (
                      <span className="mt-3 h-full w-px bg-black/10 dark:bg-white/10" />
                    )}
                  </div>
                  <div
                    className={`flex-1 space-y-2 ${
                      index < nextSteps.length - 1
                        ? "border-b border-black/10 pb-6 dark:border-white/10"
                        : ""
                    }`}
                  >
                    <Heading className="text-2xl title" size="h3">
                      {step.title}
                    </Heading>
                    <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
                      {step.body}
                    </Text>
                  </div>
                </div>
              ))}
            </Card>
          </section>

          <Divider />

          <Card variant="solid" size="lg" className="space-y-6">
            <div className="max-w-3xl space-y-3">
              <Heading className="text-2xl title" size="h3">
                Community first, even when a brand is involved
              </Heading>
              <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
                A partnership can help create something memorable. It cannot buy
                access to the people who make Ryan Meetup worth showing up for.
              </Text>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {partnershipBoundaries.map((boundary) => (
                <li
                  key={boundary.title}
                  className="space-y-2 rounded-2xl border border-black/10 bg-black/5 p-5 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <Heading className="text-lg title" size="h4">
                    {boundary.title}
                  </Heading>
                  <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
                    {boundary.body}
                  </Text>
                </li>
              ))}
            </ul>

            <Text className="border-t border-black/10 pt-5 text-sm font-semibold leading-6 dark:border-white/10">
              Every collaboration has to add to the Ryan experience—not
              interrupt it, extract from it, or make the community feel like the
              product.
            </Text>
          </Card>
        </div>
      </div>
    </div>
  </Layout>
);

export { PartnershipsPage };

const LegacyPartnershipsRedirect = () => {
  permanentRedirect("/sponsors/partnerships");
};

export default LegacyPartnershipsRedirect;
