// Components
import { Layout } from "@/components/navigation";
import { Button, Card, Heading, Kicker, Text } from "@ryanmeetup/ui";
import QRCode from "react-qr-code";
import NextLink from "next/link";
import { STORE_URL } from "@/lib/store";
import NextImage from "next/image";
import { FaShirt as Shirt } from "react-icons/fa6";

// Types
import { buildPageMetadata } from "@/utils/metadata";
import type { ReactNode } from "react";

export const metadata = buildPageMetadata({
  title: "Donate to the Ryan Meetup",
  description: "Donate to the Ryan Meetup to help keep events funded.",
  canonical: "https://ryanmeetup.com/donate",
  image: {
    url: "https://ryanmeetup.com/meta/donate.webp",
    width: 1000,
    height: 714,
  },
  keywords: [
    "donate to ryan meetup",
    "ryan meetup donation",
    "ryan meetup donate",
    "ryan meetup venmo",
    "ryan meetup zelle",
    "ryan meetup support",
  ],
});

type DonateOptionCardProps = {
  visual: ReactNode;
  logoSrc: string;
  logoAlt: string;
  value: string;
  valueHref?: string;
  method: string;
};

const DonateOptionCard = (props: DonateOptionCardProps) => {
  const { visual, logoSrc, logoAlt, value, valueHref, method } = props;

  return (
    <Card variant="soft" size="md" hover className="text-center">
      <div className="mx-auto flex h-[200px] w-[200px] items-center justify-center rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/90">
        {visual}
      </div>
      <div className="relative mx-auto mt-3 h-16 w-36">
        <NextImage
          src={logoSrc}
          fill
          alt={logoAlt}
          style={{ objectFit: "contain" }}
        />
      </div>
      {valueHref ? (
        <NextLink
          href={valueHref}
          className="mt-2 inline-flex text-base lg:text-lg font-semibold text-blue-700 hover:underline dark:text-blue-500"
        >
          {value}
        </NextLink>
      ) : (
        <Text className="mt-2 text-base lg:text-lg font-semibold text-blue-700 dark:text-blue-500">
          {value}
        </Text>
      )}
      <Kicker className="mt-1">{method}</Kicker>
    </Card>
  );
};

const DonatePage = async () => {
  const backendItems = [
    {
      title: "Vercel web hosting",
      body: "Keeps our site live and tracks visitor analytics.",
    },
    {
      title: "Google Drive storage",
      body: "Thousands of event photos stored in 4K.",
    },
    {
      title: "QR code generator",
      body: "Customized codes for flyers with analytics tracking.",
    },
    {
      title: "Email hosting",
      body: "Official @ryanmeetup.com addresses for press and sponsorships.",
    },
    {
      title: "Merch production costs",
      body: "Production fees that get reimbursed through sales.",
    },
    {
      title: "Storage unit",
      body: "After 3+ years of storing event materials between our own apartments, it has become necessary to have a dedicated space.",
    },
    {
      title: "Financial and legal filings",
      body: "Required compliance and paperwork to keep the organization in good standing.",
    },
  ];

  const eventItems = [
    "Venue rentals.",
    "Food vendors and catering.",
    "Decorations: balloons, backdrops, and the little touches around the venue.",
    "Prizes and supplies: from beer for the St. Ryan’s Day chug competition to beer steins and sausages for Rytoberfest.",
    "Props and details that make events feel special and thematic.",
    "Entertainment: DJs, performers, and other talent to keep the party going.",
    "Local Ryan artists: graphic design, tattoos, and other creative collaborations.",
    "Event marketing to reach more Ryans.",
  ];

  return (
    <Layout className="space-y-10">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="order-2 space-y-6 lg:order-1">
          <Heading className="text-4xl title sm:text-5xl lg:text-6xl" size="h1">
            Help power the next Ryan Meetup.
          </Heading>

          <Text className="text-lg text-black/70 dark:text-white/70">
            Our not-for-profit organization is sustained by donations and
            community support. Ryan Meetup isn&apos;t tax-exempt, so donations
            aren&apos;t tax-deductible, but every one of them goes straight
            into the next meetup.
          </Text>

          <Text className="text-lg text-black/70 dark:text-white/70">
            All donations go towards setting up future Ryan Meetup events (ie:
            renting out spaces, buying name tags, trophies, decorations, etc, as
            well as tightening up security against potential Bryan intruders at
            our events).
          </Text>

          <Text className="text-lg text-black/70 dark:text-white/70">
            In short: every cent goes back into Ryans, not pockets.
          </Text>

          <Card variant="soft" size="md">
            <Text className="text-sm font-semibold uppercase tracking-caps text-black/80 dark:text-white/80">
              Prefer merch instead?
            </Text>
            <Text className="mt-3 text-sm text-black/70 dark:text-white/70">
              Purchase Ryan Meetup merchandise directly to support future events
              and community growth.
            </Text>
            <Button.Link
              href={STORE_URL}
              variant="secondary"
              size="sm"
              fullWidth
              className="mt-4"
              leftIcon={<Shirt className="w-4 h-4" />}
            >
              Shop merch
            </Button.Link>
          </Card>
          <Card variant="soft" size="md">
            <Text className="text-sm font-semibold uppercase tracking-caps text-black/80 dark:text-white/80">
              Where does all the money go?
            </Text>
            <Text className="mt-3 text-sm text-black/70 dark:text-white/70">
              All the money Ryan Meetup brings in goes straight back into
              running the organization and hosting future events. That includes
              the behind-the-scenes tools and services that keep things running
              smoothly, like:
            </Text>
            <ul className="mt-4 space-y-2">
              {backendItems.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-black dark:bg-white" />
                  <Text className="text-sm text-black/70 dark:text-white/70">
                    <span className="font-semibold text-black dark:text-white">
                      {item.title}
                    </span>
                    : {item.body}
                  </Text>
                </li>
              ))}
            </ul>
            <Text className="mt-4 text-sm text-black/70 dark:text-white/70">
              On top of that, large-scale events aren’t cheap — venues,
              materials, and logistics all add up.
            </Text>
          </Card>

          <Card variant="soft" size="md">
            <Text className="text-sm font-semibold uppercase tracking-caps text-black/80 dark:text-white/80">
              What kinds of things does Ryan Meetup spend money on?
            </Text>
            <Text className="mt-3 text-sm text-black/70 dark:text-white/70">
              Beyond subscriptions and backend costs, most of our spending goes
              towards making our events as memorable as possible. That includes:
            </Text>
            <ul className="mt-4 space-y-2">
              {eventItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-black dark:bg-white" />
                  <Text className="text-sm text-black/70 dark:text-white/70">
                    {item}
                  </Text>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-24">
          <div className="flex items-center justify-center sm:justify-between sm:text-left">
            <Heading
              className="text-2xl title text-center sm:text-3xl"
              size="h2"
            >
              Two easy ways to donate
            </Heading>
            <Text className="hidden text-xs font-semibold uppercase tracking-caps-wide text-black/70 dark:text-white/70 sm:inline-block">
              2 options
            </Text>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1">
            <DonateOptionCard
              method="Zelle"
              value="theryanmeetup@gmail.com"
              logoSrc="/logos/zellelogo.png"
              logoAlt="Zelle Logo"
              visual={
                <NextImage
                  src="/zelle.png"
                  width={180}
                  height={180}
                  alt="Zelle"
                />
              }
            />

            <DonateOptionCard
              method="Venmo"
              value="@RyanMeetup"
              valueHref="https://venmo.com/code?user_id=3841296049374520231&created=1690776081.636693&printed=1"
              logoSrc="/logos/venmo-logo.png"
              logoAlt="Venmo Logo"
              visual={
                <QRCode
                  value="https://venmo.com/code?user_id=3841296049374520231&created=1690776081.636693&printed=1"
                  size={160}
                />
              }
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default DonatePage;
