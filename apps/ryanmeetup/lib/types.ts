// Types
import type { ReactNode } from "react";

// #region Contentful Types
type ContentfulSys = {
  id: string;
  type: string;
  linkType: string;
};

type ContentfulFile = {
  contentType: string;
  details: {
    image: {
      height: number;
      width: number;
    };
    size: number;
  };
  fileName: string;
  url: string;
};

type ContentfulImage = {
  fields: {
    title: string;
    description: string;
    file: ContentfulFile;
  };
  metaData: {
    tags: string[];
  };
  sys: {
    createdAt: string;
    environment: {
      sys: ContentfulSys;
    };
  };
  id: string;
  locale: string;
  revision: number;
  space: {
    sys: ContentfulSys;
    type: string;
    updatedAt: string;
  };
};
// #endregion

// #region Ryan Meetup Types
type RyanEvent = {
  active: boolean;
  coverImage: ContentfulImage | string;
  description: string;
  href: string;
  title: string;
  date: Date | string;
  dateTime: string;
  city: string;
  location: string;
  venue: string;
  isPartnerEvent: boolean;
  eventType?: string | string[];
  chapter: string[];
};

type FrequentlyAskedQuestion = {
  question: string;
  answer: string;
  type: string;
  loadOrder?: number;
};

type Article = {
  title: string;
  author: string;
  outlet: string;
  href: string;
  publishDate: Date;
  publishedOn: string;
  thumbnail: ContentfulImage;
  new: boolean;
};

type MediaEvent = {
  title: string;
  date: Date;
  eventDate: string;
  bgImage: ContentfulImage;
  photoUrl: string;
  credits?: string[];
};

type Location = {
  locationName: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  eventName: string;
  eventDate: Date;
  image: ContentfulImage;
  city: string;
  locationType:
    | "Event Location"
    | "Community Event"
    | "Ryan Hub"
    | "Ryan-Named Business"
    | "Ryan-Owned Business"
    | "Chapter";
};

type TravelingRyan = {
  fullName: string;
  headshot: ContentfulImage;
  traveledTo: string;
  traveledFrom: string;
  milesTraveled: number;
  event: string;
  date: Date;
  eventDate: string;
  instagram?: string;
};

type ChampionRyan = {
  fullName: string;
  fullName2?: string;
  headshot: ContentfulImage;
  event: string;
  date: Date;
  eventDate: string;
  instagram?: string;
  instagram2?: string;
  title: string;
  location: string;
  location2?: string;
};

type RepeatRyan = {
  // The Contentful entry id, which is the only thing telling two Ryans with
  // the same name apart.
  id: string;
  fullName: string;
  headshot: ContentfulImage;
  basedIn: string;
  eventsAttended: string[];
};

type Flyer = {
  title: string;
  src: string;
};

type EventFlyer = {
  title: string;
  date: Date;
  src: ContentfulImage;
};

type RyanInNeed = {
  title: string;
  coverImage: ContentfulImage;
  goal: string;
  platform: string;
  href: string;
  completed: boolean;
};

type RyanChapter = {
  city: string;
  slug: string;
  state: string;
  chapterLeads: string[];
  whatsAppLink: string;
  coverImage: ContentfulImage;
  seoImage?: ContentfulImage;
  instagram: string;
};

type Sponsor = {
  name: string;
  href: string;
  active?: boolean;
  backerTier?: "community-backer" | "operations-partner" | "sustaining-partner";
  backerDescription?: string;
  partnershipType?:
    | "Recurring Sponsor"
    | "Featured Brand Partner"
    | "Community Supporter";
  darkModeImage: ContentfulImage;
  lightModeImage: ContentfulImage;
};

type Outlet = {
  title: string;
  href: string;
  darkModeImage: ContentfulImage;
  lightModeImage: ContentfulImage;
};

type Testimonial = {
  lastName?: string;
  headshot?: ContentfulImage;
  quote: string;
  location: string;
};
// #endregion

type Route = {
  icon: ReactNode;
  text: string;
  href: string;
  description?: string;
};

type ContactFormFields = {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  detail: string;
  subject: string;
  message: string;
};

/**
 * One host team in the Ryan Baseball Classic (Contentful `baseballTeam`).
 * Each team hosts a single Ryan night. `servesStates` and `servesCities` list
 * the places without a team of their own that this one covers, so a Vermont
 * Ryan filtering by state still finds the closest game.
 */
type BaseballTeam = {
  name: string;
  slug: string;
  logo: ContentfulImage;
  city: string;
  /** Two-letter postal abbreviation, e.g. "NH". */
  state: string;
  venue?: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  /** ISO date, e.g. "2027-06-12". */
  gameDate: string;
  ticketUrl: string;
  servesStates?: string[];
  servesCities?: string[];
};

type Charity = {
  title: string;
  amount: string;
  href: string;
  avatars?: ContentfulImage[];
  hrefs?: string[];
};

export type {
  RyanEvent,
  TravelingRyan,
  ChampionRyan,
  RepeatRyan,
  FrequentlyAskedQuestion,
  Article,
  MediaEvent,
  Location,
  ContentfulImage,
  Route,
  Flyer,
  ContactFormFields,
  RyanInNeed,
  RyanChapter,
  Sponsor,
  Outlet,
  Testimonial,
  Charity,
  EventFlyer,
  BaseballTeam,
};
