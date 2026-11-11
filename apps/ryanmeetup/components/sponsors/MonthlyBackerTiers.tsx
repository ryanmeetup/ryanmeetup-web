import {
  Button,
  Card,
  Heading,
  IconBadge,
  Pill,
  Text,
} from "@ryanmeetup/ui";
import { BiMailSend as Send } from "react-icons/bi";
import { FaRegHeart as Heart } from "react-icons/fa";

import { monthlyBackerTiers } from "@/lib/sponsorship-program";
import { buildMonthlyBackerTierHref, contactHrefs } from "@/utils/contact";

const MonthlyBackerTiers = () => (
  <section
    id="monthly-backers"
    className="@container scroll-mt-28 space-y-6"
    aria-labelledby="monthly-backer-tier-heading"
  >
    <div className="space-y-3">
      <Heading
        id="monthly-backer-tier-heading"
        className="text-3xl title sm:text-4xl lg:text-5xl"
        size="h2"
      >
        Pick the support level that fits
      </Heading>
      <Text className="max-w-4xl text-base text-black/70 dark:text-white/70">
        Every tier helps keep Ryan Meetup active, welcoming, and increasingly
        difficult to explain to non-Ryans. We will talk through the best fit
        before anything starts.
      </Text>
    </div>

    <div className="grid gap-4 @4xl:grid-cols-3">
      {monthlyBackerTiers.map((tier) => (
        <Card
          key={tier.slug}
          variant={tier.slug === "operations-partner" ? "solid" : "soft"}
          size="lg"
          className="flex h-full flex-col gap-5"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill
                size="md"
                variant="default"
                className="!border-[#f6c500] !bg-[#f6c500] !px-4 !py-2 !font-bold !text-[#4b210f] shadow-[0_8px_24px_-12px_rgba(246,197,0,0.9)]"
              >
                ${tier.price}/month
              </Pill>
            </div>
            <Heading className="text-2xl title" size="h3">
              {tier.name}
            </Heading>
            <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
              {tier.summary}
            </Text>
          </div>

          <ul className="grow space-y-3 border-t border-black/10 pt-5 dark:border-white/10">
            {tier.deliverables.map((deliverable) => (
              <li
                key={deliverable}
                className="flex items-start gap-3 text-sm leading-6 text-black/70 dark:text-white/70"
              >
                <span
                  aria-hidden
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-black/65 dark:bg-white/65"
                />
                <span>{deliverable}</span>
              </li>
            ))}
          </ul>

          <Button.Link
            href={buildMonthlyBackerTierHref(tier.slug)}
            leftIcon={<Send className="h-4 w-4" />}
            variant="primary"
            size="lg"
            fullWidth
            newTab={false}
            className="mt-auto"
            aria-label={`Back the ${tier.name} tier`}
          >
            Back this tier
          </Button.Link>
        </Card>
      ))}
    </div>

    <Card variant="solid" size="lg" className="space-y-5">
      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] @3xl:items-center @3xl:gap-8">
        <div className="flex items-start gap-4">
          <IconBadge size="lg">
            <Heart className="h-4 w-4" />
          </IconBadge>
          <div className="space-y-2">
            <Heading className="text-2xl title @3xl:text-3xl" size="h3">
              Want to support the Ryans?
            </Heading>
            <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
              Pick a tier above and the contact form arrives with it filled in.
              A Ryan will confirm placement, billing, and start date. No
              application, no scoping call required.
            </Text>
          </div>
        </div>

        <div className="space-y-3 border-black/10 @3xl:border-l @3xl:pl-8 dark:border-white/10">
          <Text className="text-sm leading-6 text-black/70 dark:text-white/70">
            Not sure which tier fits? A Ryan will help you choose.
          </Text>
          <Button.Link
            href={contactHrefs.partnershipsMonthlyBacker}
            leftIcon={<Send className="h-4 w-4" />}
            variant="secondary"
            size="md"
            fullWidth
            newTab={false}
          >
            Ask a Ryan
          </Button.Link>
        </div>
      </div>

      <Text className="border-t border-black/10 pt-4 text-xs leading-5 text-black/60 dark:border-white/10 dark:text-white/60">
        Newsletter benefits begin when the monthly newsletter is actively
        publishing. Monthly Backers receive visibility, not dedicated email
        blasts or access to private community spaces.
      </Text>
    </Card>
  </section>
);

export { MonthlyBackerTiers };
