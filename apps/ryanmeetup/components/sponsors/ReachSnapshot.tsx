"use client";

import { useState } from "react";

import Image from "next/image";
import NextLink from "next/link";

import { Card, Heading, Kicker, Modal, Text } from "@ryanmeetup/ui";
import {
  GoArrowRight as ArrowRight,
  GoArrowUpRight as ArrowUpRight,
} from "react-icons/go";

const reachSnapshot = [
  {
    value: "112k+",
    label:
      "Followers on Instagram; and we're still consistently growing even bigger",
    href: "https://www.instagram.com/ryanmeetup/",
    cta: "Instagram",
    external: true,
  },
  {
    value: "3M+",
    label: "Monthly views across Instagram and TikTok",
    href: "https://www.tiktok.com/@ryanmeetup/",
    cta: "TikTok",
    external: true,
  },
  {
    value: "140k+",
    label: "Annual visitors to RyanMeetup.com",
    cta: "Site traffic",
    modal: true,
  },
  {
    value: "400+",
    label: "Ryans attending each of our events on average",
    href: "/gallery",
    cta: "Past events",
    external: false,
  },
  {
    value: "13+",
    label: "Active chapters across North America, with more to come",
    href: "/chapters",
    cta: "Chapters",
    external: false,
  },
  {
    value: "20+",
    label:
      "Events hosted each year across our national calendar and local chapters",
    href: "/events/all",
    cta: "All events",
    external: false,
  },
];

const ReachSnapshot = () => {
  const [showTrafficModal, setShowTrafficModal] = useState(false);

  return (
    <>
      <Card variant="solid" size="lg" className="space-y-4">
        <Kicker>Reach snapshot</Kicker>

        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {reachSnapshot.map((item) => {
            const content = (
              <Card
                variant="soft"
                size="md"
                hover
                className="flex h-full flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <Heading className="text-3xl title" size="h3">
                    {item.value}
                  </Heading>
                  <Text className="text-sm text-black/70 dark:text-white/70">
                    {item.label}
                  </Text>
                </div>

                <span className="inline-flex items-center gap-1 text-sm font-semibold text-black/70 transition group-hover:text-black dark:text-white/70 dark:group-hover:text-white">
                  {item.cta}
                  {item.external ? (
                    <ArrowUpRight aria-hidden className="h-4 w-4" />
                  ) : (
                    <ArrowRight aria-hidden className="h-4 w-4" />
                  )}
                </span>
              </Card>
            );

            if (item.modal) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setShowTrafficModal(true)}
                  className="group block cursor-pointer text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
                >
                  {content}
                </button>
              );
            }

            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
                >
                  {content}
                </a>
              );
            }

            return (
              <NextLink
                key={item.label}
                href={item.href!}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
              >
                {content}
              </NextLink>
            );
          })}
        </div>
      </Card>

      <Modal
        open={showTrafficModal}
        setIsOpen={setShowTrafficModal}
        title="Website Traffic Snapshot"
        closable
        dismissOnOutsideClick
        size="2xl"
        panelClassName="p-4 sm:p-5 lg:p-6"
      >
        <div className="space-y-4">
          <Text className="text-sm text-black/70 dark:text-white/70">
            Recent Ryan Meetup website traffic showing annual visitors, page
            views, and traffic growth.
          </Text>

          <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
            <Image
              src="/stats2.png"
              alt="Ryan Meetup website traffic snapshot"
              width={2902}
              height={890}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export { ReachSnapshot };
