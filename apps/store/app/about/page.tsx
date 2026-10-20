import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button, Heading, Kicker, Pill, Text } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";

export const metadata: Metadata = {
  title: "About the store",
  description: "Ryan General Store is the official Ryan Meetup shop. Every purchase helps fund Ryan Meetup events and activities.",
};

const linkClassName = "font-semibold underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40";

export default function AboutPage() {
  return (
    <main className="store-container py-8 sm:py-12 lg:py-16">
      <article className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-5">
          <Pill>About the store</Pill>
          <Heading size="h1" className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Official provisions for the Ryan people.
          </Heading>
          <Text className="text-lg text-black/80 dark:text-white/80">
            Ryan General Store is the official shop of Ryan Meetup, the gathering of people named Ryan. New to the Ryanverse?{" "}
            <a href="https://ryanmeetup.com/about" className={linkClassName}>Read the full story on RyanMeetup.com</a>.
          </Text>
        </header>

        <div className="relative aspect-[3/2] overflow-hidden rounded-3xl border border-black/10 shadow-[0_35px_70px_-50px_rgba(0,0,0,0.6)] dark:border-white/10">
          <Image
            src="/hero/ryan-merch-table.jpg"
            alt="Ryans browsing official Ryan Meetup shirts and hats at a merch table"
            fill
            priority
            sizes="(min-width: 768px) 48rem, 100vw"
            className="object-cover"
          />
        </div>

        <section className="space-y-3 border-t border-black/10 pt-8 dark:border-white/10">
          <Kicker>Where your money goes</Kicker>
          <Heading size="h2" className="text-2xl sm:text-3xl">Every shirt keeps the meetups meeting.</Heading>
          <Text>
            Purchases help fund Ryan Meetup events, activities, and the organization behind them. Wear the shirt, fund the next gathering.
          </Text>
        </section>

        <section className="space-y-3 border-t border-black/10 pt-8 dark:border-white/10">
          <Kicker>How it’s made</Kicker>
          <Heading size="h2" className="text-2xl sm:text-3xl">Printed when you order it.</Heading>
          <Text>
            Our printing partner, Printful, makes each item on demand and ships it straight to you. Nothing sits in a warehouse waiting for its Ryan, so give your order a little time to be made before it heads your way.
          </Text>
        </section>

        <section className="space-y-3 border-t border-black/10 pt-8 dark:border-white/10">
          <Kicker>Who it’s for</Kicker>
          <Heading size="h2" className="text-2xl sm:text-3xl">You don’t have to be a Ryan.</Heading>
          <Text>
            Ryans, Ryan’s dads, friends of Ryans, and admirers from afar are all welcome here. Some designs are made specifically for the people who love a Ryan.
          </Text>
        </section>

        <section className="space-y-3 border-t border-black/10 pt-8 dark:border-white/10">
          <Kicker>Shipping and returns</Kicker>
          <Heading size="h2" className="text-2xl sm:text-3xl">The fine print.</Heading>
          <Text>
            Printful handles fulfillment and ships to most of the world. Their{" "}
            <a href="https://www.printful.com/shipping" target="_blank" rel="noopener noreferrer" className={linkClassName}>shipping guidelines</a>{" "}
            cover where orders can go and how long delivery takes.
          </Text>
          <Text>
            We can’t accept returns. Every item is printed for its order, and we don’t have a back room to send it to. If something about your order looks wrong,{" "}
            <Link href="/contact" className={linkClassName}>contact store support</Link> and we’ll take a look.
          </Text>
        </section>

        <div className="flex flex-col gap-3 border-t border-black/10 pt-8 sm:flex-row dark:border-white/10">
          <Button.Link href="/collections/all" size="lg" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight />}>
            Shop the collection
          </Button.Link>
          <Button.Link href="/contact" size="lg" variant="secondary" className="!w-full sm:!w-auto">
            Contact the store
          </Button.Link>
        </div>
      </article>
    </main>
  );
}
