// Components
import {
  FaFacebook as Facebook,
  FaInstagram as Instagram,
  FaYoutube as YouTube,
  FaHandsHelping as Help,
  FaPhotoVideo as Gallery,
  FaTrophy as Trophy,
  FaRegNewspaper as News,
  FaMapMarkedAlt as Map,
  FaDollarSign as Dollar,
  FaScroll as Scroll,
  FaTiktok as TikTok,
  FaHome as Home,
  // FaAddressCard as Card,
} from "react-icons/fa";
import {
  FaPeopleGroup as Community,
  FaHandshakeSimple as Handshake,
  FaShirt as Shirt,
  FaThreads as Threads,
  FaPiggyBank as Charity,
  FaRegFileLines as FileLines,
} from "react-icons/fa6";
import {
  IoCalendarNumber as Calendar,
  // IoPersonAdd as Socials,
} from "react-icons/io5";
import { RiFilePaper2Line as Flyer } from "react-icons/ri";
import { HiOutlineMail as Email } from "react-icons/hi";
import { 
  MdGroup as Group,
  MdHowToVote as Suggestion,
} from "react-icons/md";
import { GoSponsorTiers as Sponsor } from "react-icons/go";
import { PiLetterCirclePBold as Party } from "react-icons/pi";

export const layoutPaddingX =
  "px-4 lg:px-32 2xl:px-56 3xl:px-[320px]"

export const socialProfileUrls = {
  instagram: "https://www.instagram.com/ryanmeetup/",
  facebook: "https://www.facebook.com/ryanmeetup/",
  partiful: "https://partiful.com/u/sJG4HpH0wS3ZA3YkzaL5",
  youtube: "https://www.youtube.com/@ryanmeetup",
  tiktok: "https://www.tiktok.com/@ryanmeetup/",
  threads: "https://www.threads.net/@ryanmeetup",
};

export const socials = [
  {
    href: socialProfileUrls.instagram,
    icon: <Instagram className="title" />,
    text: "Instagram",
    ctaVerb: "Follow",
  },
  {
    href: socialProfileUrls.facebook,
    icon: <Facebook className="title" />,
    text: "Facebook",
    ctaVerb: "Follow",
  },
  {
    href: socialProfileUrls.partiful,
    icon: <Party className="title" />,
    text: 'Partiful',
    ctaVerb: "Follow",
  },
  {
    href: socialProfileUrls.youtube,
    icon: <YouTube className="title" />,
    text: "YouTube",
    ctaVerb: "Subscribe to",
  },
  {
    icon: <TikTok className="title" />,
    text: "TikTok",
    href: socialProfileUrls.tiktok,
    ctaVerb: "Follow",
  },
  {
    icon: <Threads className="title" />,
    text: "Threads",
    href: socialProfileUrls.threads,
    ctaVerb: "Follow",
  },
  // {
  //   icon: <Whatsapp className="title" />,
  //   text: "WhatsApp",
  //   href: "/whatsapp",
  // },
];

export const routes = [
  {
    icon: <Home />,
    text: "Home",
    href: "/",
    description: "Back to the Ryan Meetup homepage.",
  },
  {
    icon: <Community />,
    text: "Community",
    href: "",
    description: "Events, chapters, and the story behind Ryan Meetup.",
    subroutes: [
      {
        icon: <Scroll />,
        text: "About",
        href: "/about",
        description: "Learn more about the Ryan Meetup.",
      },
      {
        icon: <Calendar />,
        text: "Events",
        href: "/events",
        description: "Check out upcoming meetups and RSVP details.",
      },
      {
        icon: <Party />,
        text: "Rytoberfest",
        href: "/rytoberfest",
        description: "Find the Rytoberfest celebration nearest you.",
      },
      {
        icon: <Group />,
        text: "Chapters",
        href: "/chapters",
        description: "Find local chapters and connect with your Ryans in your city.",
      },
      {
        icon: <Gallery />,
        text: "Gallery",
        href: "/gallery",
        description: "Photos and recaps from past Ryan Meetups.",
      },
      {
        icon: <Trophy />,
        text: "Awards",
        href: "/awards",
        description: "Celebrating standout Ryans and community moments.",
      },
      {
        icon: <FileLines className="shrink-0" />,
        text: "Change Name",
        href: "/name-change",
        description: "Official process and guidance for a Ryan name change.",
      },
    ],
  },
  {
    icon: <Shirt />,
    text: "Merch",
    href: "https://ryanmeetup.etsy.com",
    description: "Official Ryan Meetup merch and essentials.",
  },
  {
    icon: <Handshake />,
    text: "Get Involved",
    href: "",
    description: "Support the mission through donating, sponsoring, or helping.",
    subroutes: [
      {
        icon: <Flyer />,
        text: "Flyers",
        href: "/flyers",
        description: "Download and share promotional flyer designs.",
      },
      {
        icon: <Help />,
        text: "Contribute",
        href: "/contribute",
        description: "Check out ways to volunteer, create, and build with our team.",
      },
      {
        icon: <Dollar />,
        text: "Donate",
        href: "/donate",
        description: "Support the Ryan Meetup as we continue to grow our community.",
      },
      {
        icon: <Sponsor />,
        text: "Sponsors",
        href: "/sponsors",
        description: "Partner with us and see current sponsors.",
      },
      {
        icon: <Charity />,
        text: "Charity",
        href: "/charity",
        description: "Give back through Ryan-led charitable efforts.",
      },
      { 
        icon: <Suggestion className="shrink-0" />,
        text: "Rycommendations",
        href: "https://forms.gle/FH4vSc3ngFgqziTg9",
        description: "Have a suggestion or idea? We'd love to hear it.",
      }
      // {
      //   icon: <Card />,
      //   text: "Buy Card",
      //   href: "/cards",
      // },
    ],
  },
  {
    icon: <Map />,
    text: "Map",
    href: "/map",
    description: "Explore Ryan hubs and meetup locations.",
  },
  {
    icon: <News />,
    text: "Press",
    href: "/press",
    description: "Media coverage and press highlights.",
  },
  {
    icon: <Email />,
    text: "Contact Us",
    href: "/contact",
    description: "Get in touch with the Ryan Meetup team.",
  },
];

export const gallery = [
  {
    imageUrl: "/group-photos/ryanroundup.png",
    title: "Ryan Roundup, March 2023",
  },
  {
    imageUrl: "/group-photos/rendez.webp",
    title: "Ryan Rendezvous, May 2023",
  },
  {
    imageUrl: "/group-photos/retreat.webp",
    title: "Ryan Retreat, July 2023",
  },
  {
    imageUrl: "/group-photos/rave.webp",
    title: "Ryan Rave, September 2023",
  },
  {
    imageUrl: "/group-photos/claus.webp",
    title: "Ryan Claus, December 2023",
  },
  {
    imageUrl: "/group-photos/rodeo.webp",
    title: "Ryan Rodeo, February 2024",
  },
  {
    imageUrl: "/group-photos/stryan.webp",
    title: "St. Ryan's Day, March 2024",
  },
  {
    imageUrl: "/group-photos/ryami.webp",
    title: "Ryami Vice, May 2024",
  },
  {
    imageUrl: "/group-photos/deadpoolgroup.webp",
    title: "150 Deadpools & Wolverine, July 2024",
  },
  {
    imageUrl: "/group-photos/royale.jpg",
    title: "Ryan Royale, September 2024",
  },
  {
    imageUrl: "/group-photos/comedy.jpeg",
    title: "Last Ryan Standing, January 2025",
  },
  {
    imageUrl: "/group-photos/gameshow.jpg",
    title: "Ryan's Game Show, January 2025",
  },
  {
    imageUrl: "/group-photos/stryan2.jpg",
    title: "St. Ryans Day II, March 2025",
  },
  {
    imageUrl: "/group-photos/rockies.jpg",
    title: "Ryans @ Rockies, June 2025",
  },
  {
    imageUrl: "/group-photos/summit.jpg",
    title: "Ryan Summit, June 2025",
  },
  {
    imageUrl: "/group-photos/rytober.jpg",
    title: "Rytoberfest II, September 2025",
  },
  {
    imageUrl: "/group-photos/serhant.jpg",
    title: "Ryans Own Manhattan, December 2025",
  },
  {
    imageUrl: "/group-photos/ryansteps.jpeg",
    title: "The Ryan Steps, March 2026",
  },
  {
    imageUrl: "/group-photos/philly.jpg",
    title: "St. Ryan's Day III, March 2026",
  },
  {
    imageUrl: "/group-photos/ryancoaster.jpeg",
    title: "Ryde the Ryan Coaster, July 2026",
  },
  {
    imageUrl: "/group-photos/rbc.jpeg",
    title: "Ryan Baseball Classic, July 2026",
  },
  {
    imageUrl: "/group-photos/ryaniowa.jpeg",
    title: "Welcome to Ryan, July 2026",
  },
];

export const landingGallery = [
  {
    imageUrl: "/group-photos/rockies.jpg",
    title: "Ryans @ Rockies, June 2025",
    city: "Denver, CO",
  },
  {
    imageUrl: "/group-photos/ryanroundup.png",
    title: "Ryan Roundup, March 2023",
    city: "New York, NY",
  },
  {
    imageUrl: "/group-photos/rave.webp",
    title: "Ryan Rave, September 2023",
    city: "Los Angeles, CA",
  },
  {
    imageUrl: "/group-photos/serhant.jpg",
    title: "Ryans Own Manhattan, December 2025",
    city: "New York, NY",
  },
  {
    imageUrl: "/group-photos/comedy.jpeg",
    title: "Last Ryan Standing, January 2025",
    city: "San Diego, CA",
  },
  {
    imageUrl: "/group-photos/gameshow.jpg",
    title: "Ryan's Game Show, January 2025",
    city: "San Diego, CA",
  },
  {
    imageUrl: "/group-photos/stryan.webp",
    title: "St. Ryan's Day, March 2024",
    city: "Chicago, IL",
  },
  {
    imageUrl: "/group-photos/deadpoolgroup.webp",
    title: "150 Deadpools & Wolverine, July 2024",
    city: "New York, NY",
  },
  {
    imageUrl: "/group-photos/royale.jpg",
    title: "Ryan Royale, September 2024",
    city: "Toronto, ON",
  },
  {
    imageUrl: "/group-photos/rytober.jpg",
    title: "Rytoberfest II, September 2025",
    city: "New York, NY",
  },
  {
    imageUrl: "/group-photos/rodeo.webp",
    title: "Ryan Rodeo, February 2024",
    city: "Austin, TX",
  },
  {
    imageUrl: "/group-photos/ryami.webp",
    title: "Ryami Vice, May 2024",
    city: "Miami, FL",
  },
  {
    imageUrl: "/group-photos/ryancoaster.jpeg",
    title: "Ryde the Ryan Coaster, July 2026",
    city: "Minneapolis, MN",
  },
];
