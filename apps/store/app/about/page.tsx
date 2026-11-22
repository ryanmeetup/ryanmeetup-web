import Image from "next/image";
import Link from "next/link";
import { Button, Card, DisclosureCard, Heading, Kicker, Text } from "@ryanmeetup/ui";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { FiArrowRight, FiGlobe, FiHeart, FiHelpCircle, FiPenTool, FiTruck, FiUsers, FiXCircle } from "react-icons/fi";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";
import { getPolicies } from "@/lib/shopify";

export const metadata = buildPageMetadata({
  title: "About the store",
  description: "Ryan Meetup Store is the official Ryan Meetup shop. Every purchase helps fund Ryan Meetup events and activities.",
  canonical: "/about",
  image: DEFAULT_IMAGE,
});

const sections = [
  { id: "money", label: "Where your money goes", icon: FiHeart },
  { id: "for", label: "Who it’s for", icon: FiUsers },
  { id: "shipping", label: "Shipping and returns", icon: FiTruck },
  { id: "faq", label: "Common questions", icon: FiHelpCircle },
] as const satisfies readonly { id: string; label: string; icon: IconType }[];

const glance = [
  { icon: FiHeart, term: "Proceeds", detail: "Ryan Meetup events and activities" },
  { icon: FiPenTool, term: "Designed", detail: "In-house, by Ryan. Naturally." },
  { icon: FiGlobe, term: "Ships", detail: "28 countries and regions" },
  { icon: FiXCircle, term: "Returns", detail: "Not accepted" },
];

const ryanMeetupLinks = [
  { href: "https://ryanmeetup.com/about", label: "About Ryan Meetup" },
  { href: "https://ryanmeetup.com/events", label: "Upcoming events" },
];

const sectionClassName = "scroll-mt-24 space-y-4 border-t border-black/10 pt-8 dark:border-white/10";

const linkClassName = "font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40";

// Store questions only; everything about the meetups themselves lives on RyanMeetup.com.
const faqs: { question: string; answer: ReactNode }[] = [
  {
    question: "Can I cancel or change my order?",
    answer: (
      <>
        Yes, as long as fulfillment hasn’t started. Every item is made for your order, and once production begins we can’t stop it. <Link href="/contact" className={linkClassName}>Contact store support</Link> right away with your order number. The same goes for a mistyped address: once an order ships, it can’t be changed.
      </>
    ),
  },
  {
    question: "How do I pick the right size?",
    answer: "Every product page has a size chart. Since all sales are final, measure a shirt you already love and compare it to the chart before you order.",
  },
  {
    question: "Where’s my order?",
    answer: "Once it ships, we email you a tracking link. You can also check its status and tracking any time from Your orders.",
  },
  {
    question: "What currency will I pay in?",
    answer: "Prices may show an estimate in your local currency. Your final price, and the currency you’ll pay in, appear at checkout before you pay.",
  },
  {
    question: "Will I owe customs or import fees?",
    answer: "Orders shipped outside the United States may be charged customs duties, import taxes, or fees by the destination country. Unless they’re collected at checkout, they’re yours to pay, usually to the carrier on delivery. We can’t refund a package refused over these charges.",
  },
  {
    question: "How do reviews work?",
    answer: "Write one from the product’s page. You’ll sign in with your email, and if it’s the one you ordered with, your review gets a Verified badge. Every review is read by the team before it’s posted.",
  },
  {
    question: "Why does the RY-D card take me to RyanMeetup.com?",
    answer: "The RY-D Membership Card is custom-made by Ryan at P&M Apparel rather than by our fulfillment partner, so it’s sold on RyanMeetup.com instead of here.",
  },
  {
    question: "What is Ryan Meetup?",
    answer: (
      <>
        A community built by Ryans, for Ryans, with a mission to unite the most Ryans in one place and make history together. <a href="https://ryanmeetup.com/about" className={linkClassName}>Read the whole story</a>.
      </>
    ),
  },
];

function SectionTitle({ id, children }: { id: (typeof sections)[number]["id"]; children: string }) {
  const { icon: Icon } = sections.find((section) => section.id === id)!;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
      <span className="row-span-2 flex h-12 w-12 items-center justify-center rounded-full bg-nametag/10 text-xl text-nametag">
        <Icon aria-hidden />
      </span>
      <Heading size="h2" className="text-2xl sm:text-3xl">{children}</Heading>
    </div>
  );
}

// The fine print points at the full policy only when it's written in Shopify Admin.
async function getPolicyHandles() {
  const policies = await getPolicies().catch((error: unknown) => {
    console.error("Could not load policies for the About page.", error);
    return [];
  });
  return new Set(policies.map(({ handle }) => handle));
}

export default async function AboutPage() {
  const policyHandles = await getPolicyHandles();
  return (
    <main className="store-container py-8 sm:py-12 lg:py-16">
      <div className="grid gap-12 xl:grid-cols-[20rem_minmax(0,1fr)] xl:gap-16">
        <article className="min-w-0 space-y-12">
          <header className="space-y-5">
            <Heading size="h1" className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              Official goods. Unmistakably Ryan.
            </Heading>
            <Text className="max-w-3xl text-lg text-black/80 dark:text-white/80">
              Gear for Ryans and the people who love them. Every purchase helps make the next meetup happen. New to the Ryanverse?{" "}
              <a href="https://ryanmeetup.com/about" className={linkClassName}>Get to know Ryan Meetup</a>.
            </Text>
          </header>

          <div className="relative aspect-[3/2] overflow-hidden rounded-3xl border border-black/10 shadow-drop-lg lg:aspect-[2/1] dark:border-white/10">
            <Image
              src="/hero/ryan-merch-table.jpg"
              alt="Ryans browsing official Ryan Meetup shirts and hats at a merch table"
              fill
              priority
              sizes="(min-width: 1280px) 60rem, 100vw"
              className="object-cover"
            />
          </div>

          {/* Two independent stacks, not a row grid: each row would otherwise stretch to its
              tallest section and leave the short ones floating above a gap. */}
          <div className="grid gap-8 2xl:grid-cols-2 2xl:items-start 2xl:gap-x-10">
            <div className="grid gap-8 2xl:gap-12">
              <section id="money" className={sectionClassName}>
                <SectionTitle id="money">Every shirt keeps the meetups meeting.</SectionTitle>
                <Text className="max-w-3xl">
                  Every order goes to Ryan Meetup Inc., the New York not-for-profit corporation that runs Ryan Meetup. After what it costs to make and ship your order, every cent goes back into Ryans, not pockets.
                </Text>
                <Text className="max-w-3xl">
                  That money is how we fund meetups in cities all over and keep them free or cheap to attend. It covers venues, food, decorations, name tags, and prizes, plus the behind-the-scenes costs: web hosting, a storage unit for event gear, and the filings that keep the organization in good standing.{" "}
                  <a href="https://ryanmeetup.com/donate" className={linkClassName}>See the full breakdown</a>.
                </Text>
                <Text className="max-w-3xl">
                  Ryan Meetup is a not-for-profit, but it isn’t tax-exempt, so purchases aren’t tax-deductible. Thank you, Ryans, for your support.
                </Text>
              </section>
            </div>

            <div className="grid gap-8 2xl:gap-12">
              <section id="for" className={sectionClassName}>
                <SectionTitle id="for">You don’t have to be a Ryan.</SectionTitle>
                <Text className="max-w-3xl">
                  Ryans, Ryan’s dads, friends of Ryans, and admirers from afar are all welcome here. Some designs are made specifically for the people who love a Ryan.
                </Text>
              </section>

              <section id="shipping" className={sectionClassName}>
                <SectionTitle id="shipping">The fine print.</SectionTitle>
                <Text className="max-w-3xl">
                  We ship to 28 countries and regions across North America, Europe, Asia-Pacific, and the Middle East. Each item is made after you order it, so it takes a few business days before it ships. Shipping costs for your address appear at checkout, and tracking details arrive by email once your order is on its way.
                  {policyHandles.has("shipping-policy") && (
                    <>
                      {" "}Production times, customs, and the rest are in our <Link href="/policies/shipping-policy" className={linkClassName}>shipping policy</Link>.
                    </>
                  )}
                </Text>
                <Text className="max-w-3xl">
                  <strong className="font-semibold text-black dark:text-white">All sales are final.</strong> We can’t accept returns or exchanges: orders ship from our fulfillment partner, and we have nowhere to receive a return or swap it from. If something arrives damaged, defective, or not what you ordered,{" "}
                  <Link href="/contact" className={linkClassName}>contact store support</Link> and we’ll make it right.
                  {policyHandles.has("refund-policy") && (
                    <>
                      {" "}The details are in our <Link href="/policies/refund-policy" className={linkClassName}>return and refund policy</Link>.
                    </>
                  )}
                </Text>
              </section>
            </div>
          </div>

          <section id="faq" className={sectionClassName}>
            <SectionTitle id="faq">Questions, answered.</SectionTitle>
            <div className="grid gap-4">
              {faqs.map(({ question, answer }) => (
                <DisclosureCard key={question} heading="h3" summary={<span className="font-semibold">{question}</span>}>
                  <Text className="max-w-3xl">{answer}</Text>
                </DisclosureCard>
              ))}
            </div>
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
