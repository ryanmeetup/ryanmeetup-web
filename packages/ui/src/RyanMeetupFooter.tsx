import {
  FaFacebook as Facebook,
  FaInstagram as Instagram,
  FaTiktok as TikTok,
  FaYoutube as YouTube,
} from "react-icons/fa";
import { FaThreads as Threads } from "react-icons/fa6";
import { PiLetterCirclePBold as Partiful } from "react-icons/pi";
import {
  SiteFooter,
  type SiteFooterLink,
  type SiteFooterSection,
} from "./SiteFooter";

export type RyanMeetupFooterProps = {
  className?: string;
  homeHref?: string;
  /** Site-specific link columns, shown before the shared Ryan Meetup ones. */
  sections?: SiteFooterSection[];
  /** Repeat the social links as a text column. Off where the labelled icon row is enough. */
  followColumn?: boolean;
  /** The site's own stack. Each site runs on different services, so none is assumed. */
  builtWith: SiteFooterLink[];
};

const socialLinks = [
  {
    href: "https://www.instagram.com/ryanmeetup/",
    icon: <Instagram className="title" />,
    label: "Instagram",
  },
  {
    href: "https://www.facebook.com/ryanmeetup/",
    icon: <Facebook className="title" />,
    label: "Facebook",
  },
  {
    href: "https://partiful.com/u/sJG4HpH0wS3ZA3YkzaL5",
    icon: <Partiful className="title" />,
    label: "Partiful",
  },
  {
    href: "https://www.youtube.com/@ryanmeetup",
    icon: <YouTube className="title" />,
    label: "YouTube",
  },
  {
    href: "https://www.tiktok.com/@ryanmeetup/",
    icon: <TikTok className="title" />,
    label: "TikTok",
  },
  {
    href: "https://www.threads.net/@ryanmeetup",
    icon: <Threads className="title" />,
    label: "Threads",
  },
];

export function RyanMeetupFooter({
  className,
  homeHref = "/",
  sections = [],
  followColumn = true,
  builtWith,
}: RyanMeetupFooterProps) {
  return (
    <SiteFooter
      title="RYAN MEETUP"
      subtitle="NO BRYANS ALLOWED"
      homeHref={homeHref}
      className={className}
      sections={[
        ...sections,
        ...(followColumn
          ? [{ title: "Follow us", links: socialLinks.map(({ href, label }) => ({ href, label })) }]
          : []),
        {
          title: "Built with",
          columns: 2,
          links: builtWith,
        },
      ]}
      socialLinks={socialLinks}
      socialLabel="Follow us"
      credit={{ href: "https://ryanle.dev/", label: "Ryan Le" }}
    />
  );
}
