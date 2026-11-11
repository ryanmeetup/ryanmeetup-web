import NextLink from "next/link";

import { Card, Heading, Text } from "@ryanmeetup/ui";
import { GoArrowRight as ArrowRight } from "react-icons/go";

// Real next steps rather than claims about the community: each one goes to a
// page where a visitor can actually act on it.
const steps = [
  {
    title: "Find your chapter",
    body: "Local Ryans, local meetups. See which cities already have one.",
    href: "/chapters",
  },
  {
    title: "Come to the next event",
    body: "See what's on the calendar and RSVP while there's room.",
    href: "/events/upcoming",
  },
  {
    title: "Get the newsletter",
    body: "New events, new chapters, and big Ryan news, straight to your inbox.",
    href: "/newsletter",
  },
] as const;

const BenefitsSection = () => (
  <section className="space-y-6" aria-labelledby="get-involved-heading">
    <div className="space-y-2">
      <Heading id="get-involved-heading" className="text-4xl title" size="h2">
        Get involved
      </Heading>
      <Text className="text-base text-black/70 dark:text-white/70">
        Three ways to go from reading about Ryans to meeting them.
      </Text>
    </div>

    <ul className="grid gap-4 lg:grid-cols-3">
      {steps.map((step) => (
        <li key={step.href}>
          <NextLink
            href={step.href}
            className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
          >
            <Card
              variant="soft"
              size="md"
              hover
              className="flex h-full flex-col gap-2"
            >
              <Heading
                className="flex items-center justify-between gap-3 text-2xl title"
                size="h3"
              >
                {step.title}
                <ArrowRight
                  aria-hidden
                  className="h-5 w-5 shrink-0 transition-transform motion-safe:group-hover:translate-x-1"
                />
              </Heading>
              <Text className="text-sm text-black/70 dark:text-white/70">
                {step.body}
              </Text>
            </Card>
          </NextLink>
        </li>
      ))}
    </ul>
  </section>
);

export { BenefitsSection };
