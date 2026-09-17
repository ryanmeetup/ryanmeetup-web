"use client";

import { useState, useEffect } from "react";

// Components
import { Banner, Header } from "@/components/navigation";
import { FloatingCta } from "@/components/global";
import { RyanMeetupFooter } from "@ryanmeetup/ui";
import { FiSun } from "react-icons/fi";
import {
  FaCalendarAlt as Calendar,
  FaMapMarkerAlt as MapPin,
} from "react-icons/fa";
import { useTheme } from "next-themes";
import { layoutPaddingX } from "@/lib/constants";

// Types
import type { ReactNode } from "react";

type LayoutProps = {
  className?: string;
  children: ReactNode;
  fullscreen?: boolean;
};

const californiaCampaignExpiresAt = "2026-09-13T00:00:00-07:00";

const Layout = (props: LayoutProps) => {
  const { className, children, fullscreen = false } = props;

  const { theme } = useTheme();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <main>
      <Banner
        message="Ryan Meetup returns to California September 11–12: Ready Player Ryan + Sun Soaked!"
        href="/rsvp"
        actionLabel="RSVP"
        expiresAt={californiaCampaignExpiresAt}
        className={layoutPaddingX}
      />
      <Header />
      <section
        className={`${className}f 
                    text-white h-full flex flex-col dark:bg-black dark:text-white
                    ${isClient && theme === "light" ? "bg-[url('/crumbled.png')] bg-repeat bg-cover bg-white" : "bg-white from-white bg-gradient-to-b from-neutral-00 to-neutral-200 to-neutral-00 dark:from-neutral-900 dark:to-black"} 
                    ${fullscreen ? "bg-black" : `py-8 ${layoutPaddingX}`}`}
      >
        {children}
      </section>

      <FloatingCta
        id="ryan-meetup-california-2026"
        href="/rsvp"
        label="RSVP"
        expiresAt={californiaCampaignExpiresAt}
        details={[
          {
            title: "Ready Player Ryan",
            href: "/rpr",
            rows: [
              {
                icon: <Calendar className="h-3 w-3 fill-current" />,
                text: "September 11, 2026",
              },
              {
                icon: <MapPin className="h-3 w-3 fill-current" />,
                text: "Orange, CA",
              },
            ],
          },
          {
            title: "Ryan Meetup × Sun Soaked",
            href: "/sunsoaked",
            rows: [
              {
                icon: <Calendar className="h-3 w-3 fill-current" />,
                text: "September 12, 2026",
              },
              {
                icon: <MapPin className="h-3 w-3 fill-current" />,
                text: "Huntington Beach, CA",
              },
            ],
          },
        ]}
        ariaLabel="RSVP to upcoming California events"
        hiddenRoutes={[
          "/rsvp",
          "/rpr",
          "/sunsoaked",
          "/awards",
          "/name-change",
        ]}
        theme={{
          panel: "bg-[#ef3d23]",
          border: "border-[#f6c500] hover:border-[#ffe168]",
          text: "text-[#f4f0df]",
          subtext: "text-[#f4f0df]",
          detailIcon: "text-[#f6c500]",
          iconPanel: "bg-[#f6c500]",
          iconText: "text-[#4b210f]",
          dismissPanel:
            "border-[#f6c500] bg-[#ef3d23] text-[#f4f0df] hover:border-[#ffe168]",
          glow: "bg-[radial-gradient(circle_at_top,_rgba(246,197,0,0.4),_transparent_60%)]",
          halo: "bg-[conic-gradient(from_180deg,_rgba(246,197,0,0.65),_rgba(244,240,223,0.15),_rgba(246,197,0,0.65))]",
          focusRing: "focus-visible:ring-[#f6c500]/80",
        }}
        icon={<FiSun className="h-7 w-7" aria-hidden />}
      />

      <RyanMeetupFooter className={layoutPaddingX} />
    </main>
  );
};

export { Layout };
