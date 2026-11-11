"use client";

import { useState } from "react";

import Image from "next/image";
import NextLink from "next/link";

import { Card, Heading, IconBadge, Kicker, Modal, Text } from "@ryanmeetup/ui";
import {
  FaChartLine as Traffic,
  FaInstagram as Instagram,
  FaMapMarkedAlt as Footprint,
  FaTiktok as TikTok,
} from "react-icons/fa";
import { GoArrowUpRight as ArrowUpRight } from "react-icons/go";
import { BiParty as Party } from "react-icons/bi";

const reachSnapshot = [
  {
    value: "112k+",
    label:
      "Followers on Instagram; and we're still consistently growing even bigger",
    href: "https://www.instagram.com/ryanmeetup/",
    cta: "Instagram",
    icon: <Instagram className="h-4 w-4" />,
    external: true,
  },
  {
    value: "3M+",
    label: "Monthly views across Instagram and TikTok",
    href: "https://www.tiktok.com/@ryanmeetup/",
    cta: "TikTok",
    icon: <TikTok className="h-4 w-4" />,
    external: true,
  },
  {
    value: "140k+",
    label: "Annual visitors to RyanMeetup.com",
    cta: "Site Traffic",
    icon: <Traffic className="h-4 w-4" />,
    modal: true,
  },
  {
    value: "400+",
    label: "Ryans attending each of our events on average",
    href: "/gallery",
    cta: "Past Events",
    icon: <Party className="h-4 w-4" />,
    external: false,
  },
  {
    value: "13+",
    label: "Active chapters across North America, with more to come",
    href: "/chapters",
    cta: "Chapters",
    icon: <Footprint className="h-4 w-4" />,
    external: false,
  },
  {
    value: "20+",
    label:
      "Events hosted each year across our national calendar and local chapters",
    href: "/events/all",
    cta: "All Events",
    icon: <Party className="h-4 w-4" />,
    external: false,
  },
];

const ReachSnapshot = () => {
  const [showTrafficModal, setShowTrafficModal] = useState(false);

  return (
    <>
      <Card variant="solid" size="lg" className="space-y-4">
        <div className="space-y-1">
          <Kicker>Reach Snapshot</Kicker>
          <Text className="text-sm text-black/70 dark:text-white/70">
            Explore the channels, proof points, and community surfaces behind
            these numbers.
          </Text>
        </div>

        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {reachSnapshot.map((item) => {
            const content = (
              <Card
                variant="soft"
                size="md"
                hover
                className="flex h-full flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <IconBadge>{item.icon}</IconBadge>
                    <Heading className="text-3xl title" size="h3">
                      {item.value}
                    </Heading>
                  </div>

                  <Text className="text-sm text-black/70 dark:text-white/70">
                    {item.label}
                  </Text>
                </div>

                <div className="flex w-full items-center justify-between rounded-full border border-black/15 bg-black/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-caps-tight text-black/65 transition group-hover:border-black/35 group-hover:bg-black/10 group-hover:text-black dark:border-white/15 dark:bg-white/5 dark:text-white/65 dark:group-hover:border-white/35 dark:group-hover:bg-white/10 dark:group-hover:text-white">
                  <span>{item.cta}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </Card>
            );

            if (item.modal) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setShowTrafficModal(true)}
                  className="group block cursor-pointer text-left"
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
                  className="group block"
                >
                  {content}
                </a>
              );
            }

            return (
              <NextLink
                key={item.label}
                href={item.href!}
                className="group block"
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
