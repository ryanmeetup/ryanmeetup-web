"use client";

import { useMemo } from "react";

// Components
import NextLink from "next/link";
import {
  Button,
  Card,
  Heading,
  Kicker,
  Text,
  ThemedImage,
} from "@ryanmeetup/ui";
import { SponsorLogoMarquee } from "@ryanmeetup/sponsors";
import { SponsorLink } from "@/components/sponsors/SponsorLink";
import { buildSponsorTrackingHref } from "@/components/sponsors/SponsorLink";

// Types
import type { Sponsor } from "@/lib/types";
import { getMonthlyBackerTier } from "@/lib/sponsorship-program";

// Utilities
import { usePathname } from "next/navigation";
import { layoutPaddingX } from "@/lib/constants";
import { convertImageUrl } from "@ryanmeetup/utils";
import { contactHrefs } from "@/utils/contact";

type SponsorCarousel = {
  sponsors: Sponsor[];
};

const SponsorCarousel = (props: SponsorCarousel) => {
  const pathname = usePathname();

  const { sponsors } = props;

  const sponsorLogos = useMemo(
    () =>
      sponsors.map((sponsor) => ({
        href: sponsor.href,
        name: sponsor.name,
        active: sponsor.active,
        partnershipType: sponsor.partnershipType,
        backerTier: sponsor.backerTier,
        src: convertImageUrl(sponsor.lightModeImage) as string,
        darkSrc: convertImageUrl(sponsor.darkModeImage) as string,
      })),
    [sponsors],
  );

  const { topRow, bottomRow, featuredRecurringSponsor } = useMemo(() => {
    const recurring = sponsorLogos.filter(
      (sponsor) =>
        sponsor.partnershipType === "Recurring Sponsor" && sponsor.active,
    );
    const featured = sponsorLogos.filter(
      (sponsor) => sponsor.partnershipType === "Featured Brand Partner",
    );
    const community = sponsorLogos.filter(
      (sponsor) => sponsor.partnershipType === "Community Supporter",
    );
    const unassigned = sponsorLogos.filter(
      (sponsor) => !sponsor.partnershipType,
    );

    const primaryRow = featured;
    const secondaryRow = [...community, ...unassigned];
    const nonRecurringSponsors = [...featured, ...community, ...unassigned];

    return {
      topRow: primaryRow.length > 0 ? primaryRow : nonRecurringSponsors,
      bottomRow: secondaryRow.length > 0 ? secondaryRow : nonRecurringSponsors,
      featuredRecurringSponsor: recurring.length === 1 ? recurring[0] : null,
    };
  }, [sponsorLogos]);

  return (
    <div className="-mb-8 flex flex-col gap-4">
      {featuredRecurringSponsor ? (
        <div className={layoutPaddingX}>
          <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.24),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,247,237,0.88))] p-1 shadow-xl shadow-black/10 dark:border-white/15 dark:bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] dark:shadow-black/30">
            <div className="grid gap-6 rounded-[1.75rem] border border-white/70 bg-white/75 p-6 backdrop-blur dark:border-white/10 dark:bg-black/20 sm:p-8 xl:grid-cols-[0.8fr_1.55fr] xl:items-center">
              <div className="space-y-3 text-center xl:text-left">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-black/55 dark:text-white/55">
                  Monthly Backer spotlight
                </p>
                <h3 className="text-3xl font-black tracking-tight text-black dark:text-white sm:text-4xl">
                  {featuredRecurringSponsor.name} keeps Ryan Meetup moving
                </h3>
                <p className="mx-auto max-w-xl text-sm leading-6 text-black/65 dark:text-white/65 lg:mx-0">
                  Their ongoing support helps keep Ryan Meetup weird, welcoming,
                  and possible wherever Ryans gather. Want to put your brand
                  beside theirs?
                </p>
                <Button.Link
                  href={contactHrefs.monthlyBacker}
                  variant="primary"
                  size="sm"
                  newTab={false}
                  className="relative z-10 w-full sm:w-auto"
                >
                  Tell us about your brand
                </Button.Link>
              </div>
              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <SponsorLink
                  href={featuredRecurringSponsor.href}
                  sponsorName={featuredRecurringSponsor.name}
                  placement="homepage_recurring_spotlight"
                  partnershipType={featuredRecurringSponsor.partnershipType}
                  className="relative flex min-h-[220px] items-center justify-center rounded-3xl border border-black/10 bg-black p-6 transition hover:-translate-y-1 hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/30 sm:min-h-[280px] sm:p-8"
                >
                  <span className="absolute left-5 top-5 rounded-full border border-black/10 bg-white/90 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-black/60 dark:border-white/15 dark:bg-black/50 dark:text-white/65">
                    {getMonthlyBackerTier(featuredRecurringSponsor.backerTier)
                      ?.name ?? "Monthly Backer"}
                  </span>
                  <ThemedImage
                    src={featuredRecurringSponsor.src}
                    darkSrc={featuredRecurringSponsor.darkSrc}
                    alt={featuredRecurringSponsor.name}
                    width={1100}
                    height={550}
                    className="h-[180px] w-auto scale-110 object-contain sm:h-[230px] sm:scale-125"
                    sizes="(max-width: 640px) 440px, (max-width: 1279px) 60vw, 34vw"
                  />
                </SponsorLink>

                <NextLink
                  href={contactHrefs.monthlyBacker}
                  className="group flex w-full"
                  aria-label="Become a Monthly Backer"
                >
                  <Card
                    variant="outline"
                    size="lg"
                    hover
                    className="flex min-h-[220px] w-full items-center justify-center border-dashed bg-white/35 text-center dark:bg-white/[0.03] sm:min-h-[280px]"
                  >
                    <div className="space-y-3">
                      <Kicker>Monthly Backer opening</Kicker>
                      <Heading className="text-3xl title" size="h3">
                        Your brand here
                      </Heading>
                      <Text className="text-sm text-black/70 dark:text-white/70">
                        Join {featuredRecurringSponsor.name} in helping Ryans
                        find their people.
                      </Text>
                      <span className="inline-block text-sm font-bold text-black underline decoration-black/25 underline-offset-4 group-hover:decoration-black dark:text-white dark:decoration-white/30 dark:group-hover:decoration-white">
                        Reach out to a Ryan
                      </span>
                    </div>
                  </Card>
                </NextLink>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <SponsorLogoMarquee
        sponsors={topRow.map((sponsor) => ({
          name: sponsor.name,
          src: sponsor.src,
          darkSrc: sponsor.darkSrc,
          href: buildSponsorTrackingHref({
            href: sponsor.href,
            sponsorName: sponsor.name,
            placement: "homepage_carousel_top",
            partnershipType: sponsor.partnershipType,
            source: pathname,
          }),
        }))}
        itemClassName="mx-4 h-[120px] w-[11.5rem] sm:mx-6 sm:h-[176px] sm:w-[18rem]"
        imageClassName="h-[88px] sm:h-[128px]"
      />
      <SponsorLogoMarquee
        sponsors={bottomRow.map((sponsor) => ({
          name: sponsor.name,
          src: sponsor.src,
          darkSrc: sponsor.darkSrc,
          href: buildSponsorTrackingHref({
            href: sponsor.href,
            sponsorName: sponsor.name,
            placement: "homepage_carousel_bottom",
            partnershipType: sponsor.partnershipType,
            source: pathname,
          }),
        }))}
        speed={40}
        direction="right"
        itemClassName="mx-3 h-[92px] w-[8.5rem] sm:mx-4 sm:h-[132px] sm:w-[12.5rem]"
        imageClassName="h-[56px] sm:h-[88px]"
      />
    </div>
  );
};

export { SponsorCarousel };
