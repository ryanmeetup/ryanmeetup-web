import { BiMailSend as Send } from "react-icons/bi";
import { contactHrefs } from "@/utils/contact";
import {
  FaBullhorn as Megaphone,
  FaCalendarAlt as Calendar,
  FaInstagram as Instagram,
} from "react-icons/fa";

import { Button, Card, Heading, IconBadge, Kicker, Text } from "@ryanmeetup/ui";

const sponsorshipTracks = [
  {
    title: "Monthly Backers",
    price: "Starting at $100/month",
    description:
      "Built for brands that want a consistent presence while helping fund Ryan Meetup activity on an ongoing basis.",
    icon: <Megaphone className="h-4 w-4" />,
  },
  {
    title: "Brand Collaborations",
    price: "Scoped and priced together",
    description:
      "A fit for brands that want to build a specific meetup, city, chapter, or Ryan moment with us.",
    icon: <Calendar className="h-4 w-4" />,
  },
];

const SponsorshipInfo = () => {
  return (
    <section className="space-y-6" id="sponsorship-info">
      <div className="space-y-3">
        <Heading className="text-3xl title sm:text-4xl lg:text-5xl" size="h2">
          Sponsorship options with room to customize
        </Heading>
        <Text className="text-base text-black/70 dark:text-white/70">
          Ryan Meetup works with monthly backers and brand collaborators.
          Monthly backing is the simple, published way in; a collaboration is
          shaped—and priced—around the idea, the city, the event scope, and how
          a brand wants to show up.
        </Text>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_1fr]">
        {sponsorshipTracks.map((track) => (
          <Card
            key={track.title}
            variant="soft"
            size="lg"
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <IconBadge>{track.icon}</IconBadge>
              <div className="space-y-1">
                <Heading className="text-2xl title" size="h3">
                  {track.title}
                </Heading>
                <Kicker className="tracking-[0.2em]">{track.price}</Kicker>
              </div>
            </div>
            <Text className="text-sm text-black/70 dark:text-white/70">
              {track.description}
            </Text>
          </Card>
        ))}

        <Card variant="solid" size="lg" className="space-y-4">
          <div className="flex items-center gap-3">
            <IconBadge>
              <Instagram className="h-4 w-4" />
            </IconBadge>
            <div className="space-y-1">
              <Heading className="text-2xl title" size="h3">
                Sponsor Reach
              </Heading>
              <Kicker className="tracking-[0.2em]">Audience Snapshot</Kicker>
            </div>
          </div>
          <Text className="text-sm text-black/70 dark:text-white/70">
            Ryan Meetup can also bring digital visibility into the mix, with an
            Instagram audience of 112k+ followers and 3M+ monthly views.
          </Text>
          <Button.Link
            href={contactHrefs.sponsorship}
            leftIcon={<Send className="h-4 w-4" />}
            variant="primary"
            size="md"
            fullWidth
            newTab={false}
          >
            Get in contact
          </Button.Link>
        </Card>
      </div>
    </section>
  );
};

export { SponsorshipInfo };
