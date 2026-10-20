import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button, Card, Heading, Kicker, Pill, Text } from "@ryanmeetup/ui";
import type { IconType } from "react-icons";
import { FiArrowRight, FiGlobe, FiHeart, FiPrinter, FiTruck, FiUsers, FiXCircle } from "react-icons/fi";

export const metadata: Metadata = {
  title: "About the store",
  description: "Ryan General Store is the official Ryan Meetup shop. Every purchase helps fund Ryan Meetup events and activities.",
};

const sections = [
  { id: "money", label: "Where your money goes", icon: FiHeart },
  { id: "made", label: "How it’s made", icon: FiPrinter },
  { id: "for", label: "Who it’s for", icon: FiUsers },
  { id: "shipping", label: "Shipping and returns", icon: FiTruck },
] as const satisfies readonly { id: string; label: string; icon: IconType }[];

const glance = [
  { icon: FiHeart, term: "Proceeds", detail: "Ryan Meetup events and activities" },
  { icon: FiPrinter, term: "Made", detail: "On demand by Printful" },
  { icon: FiGlobe, term: "Ships", detail: "Most of the world, per Printful" },
  { icon: FiXCircle, term: "Returns", detail: "Not accepted" },
];

const ryanMeetupLinks = [
  { href: "https://ryanmeetup.com/about", label: "About Ryan Meetup" },
  { href: "https://ryanmeetup.com/events", label: "Upcoming events" },
];

const sectionClassName = "scroll-mt-24 space-y-4 border-t border-black/10 pt-8 dark:border-white/10";

const linkClassName = "font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40";

function SectionTitle({ id, children }: { id: (typeof sections)[number]["id"]; children: string }) {
  const { icon: Icon, label } = sections.find((section) => section.id === id)!;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
      <span className="row-span-2 flex h-12 w-12 items-center justify-center rounded-full bg-nametag/10 text-xl text-nametag">
        <Icon aria-hidden />
      </span>
      <Kicker>{label}</Kicker>
      <Heading size="h2" className="text-2xl sm:text-3xl">{children}</Heading>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="store-container py-8 sm:py-12 lg:py-16">
      <div className="grid gap-12 xl:grid-cols-[20rem_minmax(0,1fr)] xl:gap-16">
        <article className="min-w-0 space-y-12">
          <header className="space-y-5">
            <Pill>About the store</Pill>
            <Heading size="h1" className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              Official provisions for the Ryan people.
            </Heading>
            <Text className="max-w-3xl text-lg text-black/80 dark:text-white/80">
              Ryan General Store is the official shop of Ryan Meetup, the gathering of people named Ryan. New to the Ryanverse?{" "}
              <a href="https://ryanmeetup.com/about" className={linkClassName}>Read the full story on RyanMeetup.com</a>.
            </Text>
          </header>

          <div className="relative aspect-[3/2] overflow-hidden rounded-3xl border border-black/10 shadow-[0_35px_70px_-50px_rgba(0,0,0,0.6)] lg:aspect-[2/1] dark:border-white/10">
            <Image
              src="/hero/ryan-merch-table.jpg"
              alt="Ryans browsing official Ryan Meetup shirts and hats at a merch table"
              fill
              priority
              sizes="(min-width: 1280px) 60rem, 100vw"
              className="object-cover"
            />
          </div>

          <section id="money" className={sectionClassName}>
            <SectionTitle id="money">Every shirt keeps the meetups meeting.</SectionTitle>
            <Text className="max-w-3xl">
              Purchases help fund Ryan Meetup events, activities, and the organization behind them. Wear the shirt, fund the next gathering.
            </Text>
          </section>

          <section id="made" className={sectionClassName}>
            <SectionTitle id="made">Printed when you order it.</SectionTitle>
            <Text className="max-w-3xl">
              Our printing partner, Printful, makes each item on demand and ships it straight to you. Nothing sits in a warehouse waiting for its Ryan, so give your order a little time to be made before it heads your way.
            </Text>
          </section>

          <section id="for" className={sectionClassName}>
            <SectionTitle id="for">You don’t have to be a Ryan.</SectionTitle>
            <Text className="max-w-3xl">
              Ryans, Ryan’s dads, friends of Ryans, and admirers from afar are all welcome here. Some designs are made specifically for the people who love a Ryan.
            </Text>
          </section>

          <section id="shipping" className={sectionClassName}>
            <SectionTitle id="shipping">The fine print.</SectionTitle>
            <Text className="max-w-3xl">
              Printful handles fulfillment and ships to most of the world. Their{" "}
              <a href="https://www.printful.com/shipping" target="_blank" rel="noopener noreferrer" className={linkClassName}>shipping guidelines</a>{" "}
              cover where orders can go and how long delivery takes.
            </Text>
            <Text className="max-w-3xl">
              We can’t accept returns. Every item is printed for its order, and we don’t have a back room to send it to. If something about your order looks wrong,{" "}
              <Link href="/contact" className={linkClassName}>contact store support</Link> and we’ll take a look.
            </Text>
          </section>
        </article>

        <aside className="xl:order-first">
          <Card className="grid gap-6 sm:grid-cols-2 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7.5rem)] xl:grid-cols-1 xl:overflow-y-auto">
            <nav aria-label="On this page" className="hidden space-y-3 xl:block">
              <Kicker>On this page</Kicker>
              <ul className="space-y-0.5">
                {sections.map(({ id, label, icon: Icon }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-semibold text-black/70 transition hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/40"
                    >
                      <Icon aria-hidden className="shrink-0 text-nametag" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-4 xl:border-t xl:border-black/10 xl:pt-6 xl:dark:border-white/10">
              <Kicker>At a glance</Kicker>
              <dl className="space-y-3">
                {glance.map(({ icon: Icon, term, detail }) => (
                  <div key={term} className="grid grid-cols-[auto_1fr] items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nametag/10 text-nametag">
                      <Icon aria-hidden />
                    </span>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-widest text-black/70 dark:text-white/70">{term}</dt>
                      <dd className="text-sm">{detail}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            <div className="space-y-4 xl:border-t xl:border-black/10 xl:pt-6 xl:dark:border-white/10">
              <Kicker>Need a hand?</Kicker>
              <div className="flex flex-col gap-3">
                <Button.Link href="/collections/all" size="md" className="!w-full whitespace-nowrap" rightIcon={<FiArrowRight />}>
                  Shop the collection
                </Button.Link>
                <Button.Link href="/contact" size="md" variant="secondary" className="!w-full whitespace-nowrap">
                  Contact the store
                </Button.Link>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {ryanMeetupLinks.map(({ href, label }) => (
                  <li key={href}>
                    <a href={href} className={linkClassName}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
