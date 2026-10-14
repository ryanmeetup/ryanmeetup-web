"use client";

import { useState, useEffect } from "react";

// Components
import NextLink from "next/link";
import {
  Button,
  Card,
  Divider,
  Heading,
  RotatingGallery,
  Text,
} from "@ryanmeetup/ui";
import { landingGallery } from "@/lib/constants";
import { Transition } from "@headlessui/react";
import {
  FaArrowRight as ArrowRight,
  FaShirt,
  FaRegNewspaper as Newsletter,
} from "react-icons/fa6";
import { FaPeopleGroup as Chapter } from "react-icons/fa6";
import { BiParty as Party } from "react-icons/bi";
import { IoCalendarNumber as Calendar } from "react-icons/io5";

// Types
import type { ReactNode } from "react";

const Info = () => {
  return (
    <div className="space-y-4 xl:space-y-8">
      <div className="space-y-2">
        <Heading className="text-5xl title" size="h1">
          If your name is Ryan,
        </Heading>
        <Heading className="text-3xl title" size="h2">
          you&apos;re in the right place.
        </Heading>
      </div>

      <div className="space-y-4 text-base sm:text-lg text-black/70 dark:text-white/70">
        <Text>
          Welcome to the Ryan Meetup — a not-for-profit organization run by
          Ryans, for Ryans, with the ultimate goal of assembling as many Ryans
          as possible.
        </Text>
        <Text>
          A meetup for people named Ryan, with events and chapters across the
          country.
        </Text>
        <Text>
          One day, we aim to host RyanCon, and break the world record for the{" "}
          <NextLink
            href="https://www.guinnessworldrecords.com/world-records/largest-same-name-gathering-first-name"
            className="font-medium text-blue-700 dark:text-blue-500 hover:underline"
          >
            largest same name gathering
          </NextLink>{" "}
          in history.
        </Text>
        <Text>See you soon, Ryan.</Text>
      </div>
    </div>
  );
};

const Actions = () => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <Button.Link
          href="/events"
          leftIcon={<Calendar className="h-5 w-5" />}
          variant="primary"
          size="md"
          fullWidth
          className="w-full whitespace-nowrap"
          newTab={false}
        >
          Upcoming events
        </Button.Link>
        <Button.Link
          href="/chapters"
          leftIcon={<Chapter className="h-5 w-5" />}
          variant="secondary"
          size="md"
          fullWidth
          className="w-full whitespace-nowrap"
          newTab={false}
        >
          Find your chapter
        </Button.Link>
      </div>
    </div>
  );
};

type StatItem = {
  value: string;
  label: string;
  icon: ReactNode;
  href: string;
};

type LandingProps = {
  stats: StatItem[];
};

const Overview = (props: { stats: StatItem[] }) => {
  const { stats } = props;

  return (
    <div>
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Heading className="text-3xl title order-2 sm:order-1" size="h2">
          RYAN MEETUP
        </Heading>
        <div className="order-1 inline-flex items-center rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-black/70 dark:border-white/10 dark:bg-white/10 dark:text-white/70 sm:order-2">
          Established 2023
        </div>
      </div>
      <Text className="mt-2 text-sm uppercase tracking-widest text-black/70 dark:text-white/70">
        What this community has grown into
      </Text>

      <div className="grid grid-cols-2 gap-3 pt-4 text-center sm:text-left">
        {stats.map((stat) => (
          <NextLink
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border border-black/10 bg-white/80 px-3 py-4 shadow-sm dark:border-white/10 dark:bg-white/5 flex flex-col items-start gap-3 transition hover:-translate-y-1 hover:shadow-lg hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
          >
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <div className="flex h-12 w-12 md:h-10 md:w-10 lg:w-8 lg:h-8 xl:h-16 xl:w-16 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/10 dark:text-white/80">
                <span className="text-4xl">{stat.icon}</span>
              </div>
              <Heading className="text-2xl md:text-3xl xl:text-4xl font-cooper">
                {stat.value}
              </Heading>
            </div>
            <Text className="w-full whitespace-nowrap text-left text-sm uppercase tracking-[0.12em] text-black/70 dark:text-white/70 sm:w-auto sm:tracking-[0.2em]">
              {stat.label}
            </Text>
          </NextLink>
        ))}
      </div>
    </div>
  );
};

type HighlightsProps = {
  highlights: {
    icon: ReactNode;
    title: string;
    body: string;
    href: string;
    cta: string;
  }[];
};

const Highlights = (props: HighlightsProps) => {
  const { highlights } = props;
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsLarge(event.matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  if (!isLarge) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {highlights.map((item, index) => (
        <Transition
          key={item.title}
          appear={true}
          show={isLarge}
          enter="transition duration-700 ease-out"
          enterFrom="opacity-0 translate-y-6"
          enterTo="opacity-100 translate-y-0"
        >
          <Card
            variant="soft"
            size="sm"
            hover
            className={`flex flex-col gap-3 ${
              index === 0
                ? "delay-100"
                : index === 1
                  ? "delay-200"
                  : "delay-300"
            }`}
          >
            <div className="flex items-center justify-between gap-3 text-sm xl:text-base font-semibold uppercase tracking-wider">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-black text-white dark:border-white/10 dark:bg-white dark:text-black">
                {item.icon}
              </span>
              <span className="flex-1">{item.title}</span>
              <NextLink
                href={item.href}
                className="hidden xl:inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
              >
                {item.cta}
                <ArrowRight className="h-3 w-3" />
              </NextLink>
            </div>
            <Text className="text-base text-black/70 dark:text-white/70">
              {item.body}
            </Text>
            <div className="flex justify-end xl:hidden">
              <NextLink
                href={item.href}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
              >
                {item.cta}
                <ArrowRight className="h-3 w-3" />
              </NextLink>
            </div>
          </Card>
        </Transition>
      ))}
    </div>
  );
};

const Landing = (props: LandingProps) => {
  const { stats } = props;

  const highlights = [
    {
      icon: <Party className="h-5 w-5" />,
      title: "Why join Ryan Meetup",
      body: "Meet Ryans in your city, get invited to events, and help shape the community.",
      href: "/about",
      cta: "Learn more",
    },
    {
      icon: <Newsletter className="h-5 w-5" />,
      title: "Press & recognition",
      body: "See media coverage and the stories that made Ryan Meetup go viral.",
      href: "/press",
      cta: "View press",
    },
    {
      icon: <FaShirt className="h-5 w-5" />,
      title: "Support with merch",
      body: "Grab official Ryan Meetup gear and help power upcoming gatherings.",
      href: "/merch",
      cta: "Shop the store",
    },
  ];

  const slides = landingGallery.map((photo) => ({
    src: photo.imageUrl,
    alt: `${photo.title} - Ryan Meetup`,
    title: photo.title,
    city: photo.city,
  }));

  return (
    <section className="relative overflow-hidden text-black dark:text-white">
      <div className="relative flex flex-col gap-8 lg:gap-16 lg:grid lg:grid-cols-2 lg:items-center">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          <Info />
          <Actions />
          <Divider />
          <Overview stats={stats} />
        </div>

        <div className="order-1 flex flex-col space-y-6 lg:order-2">
          <RotatingGallery
            items={slides}
            sizes="(max-width: 1023px) 100vw, 50vw"
          />

          <Highlights highlights={highlights} />
        </div>
      </div>
    </section>
  );
};

export { Landing };
