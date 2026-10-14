import { buildContactHref, type ContactTopic } from "@ryanmeetup/contact";

import {
  getMonthlyBackerTier,
  type MonthlyBackerTierSlug,
} from "@/lib/sponsorship-program";

const DEFAULT_INBOX = "ryan@ryanmeetup.com";
const CHAPTERS_INBOX = "chapters@ryanmeetup.com";
/** P&M Apparel produces and fulfils RY-Ds, so order help goes straight to them. */
const CARDS_SUPPORT_INBOX = "Ryan@pmapparel.com";

const greeting = "Hi Ryan Meetup,\n\n";

/**
 * Every reason a Ryan can pick on /contact. The `value` of each topic (and of
 * its detail options) is what other pages pass through the `topic`/`detail`
 * query params, so renaming one means updating the links that point at it.
 */
const contactTopics: ContactTopic[] = [
  {
    value: "general",
    label: "General Question",
    subject: "General Inquiry",
    message: `${greeting}I have a general question and wanted to get in touch.\n`,
    routeTo: DEFAULT_INBOX,
  },
  {
    value: "events",
    label: "Events & RSVPs",
    subject: "Event Inquiry",
    description: "Questions about an upcoming Ryan Meetup or your RSVP.",
    message: `${greeting}I have a question about an upcoming Ryan Meetup.\n`,
    messagePlaceholder:
      "Which event are you asking about, and what do you need help with?",
    routeTo: DEFAULT_INBOX,
    detail: {
      label: "What about the event?",
      options: [
        { value: "first-timer", label: "I'm attending my first meetup" },
        { value: "rsvp-issue", label: "Trouble with my RSVP" },
        { value: "event-idea", label: "I have an event idea" },
        { value: "host-venue", label: "I can host or offer a venue" },
      ],
    },
  },
  {
    value: "chapters",
    label: "Local Chapters",
    subject: "Chapter Inquiry",
    description: "Starting, joining, or updating a Ryan chapter in your city.",
    message: `${greeting}I'm reaching out about a local Ryan chapter.\n`,
    messagePlaceholder: "Which city are you in, and how can we help?",
    routeTo: CHAPTERS_INBOX,
    detail: {
      label: "What about chapters?",
      options: [
        { value: "start-chapter", label: "Start a chapter in my city" },
        { value: "join-chapter", label: "Join an existing chapter" },
        { value: "chapter-lead", label: "Become a chapter lead" },
        { value: "chapter-question", label: "Question for a chapter" },
        { value: "chapter-update", label: "Update chapter details" },
      ],
    },
  },
  {
    value: "sponsorship",
    label: "Sponsorships & Partnerships",
    subject: "Sponsorship Inquiry",
    description: "Tell us about your brand and what you have in mind.",
    message: `${greeting}I'm interested in learning more about sponsorship opportunities and what a partnership with Ryan Meetup could look like for our brand.\n`,
    messagePlaceholder:
      "Who are you with, what are you hoping to do, and what's your timeline?",
    routeTo: DEFAULT_INBOX,
    detail: {
      label: "What kind of partnership?",
      options: [
        {
          value: "monthly-backer",
          label: "Become a Monthly Backer",
          message: `${greeting}I'm interested in becoming a Monthly Backer.\n\nBrand/company:\nTier I'm considering ($100 / $250 / $500):\nWebsite:\nWhat we'd like to accomplish:\n`,
          messagePlaceholder:
            "Tell us about your brand, preferred tier, website, and what you would like the sponsorship to accomplish.",
        },
        { value: "event-sponsorship", label: "Sponsor an event" },
        {
          value: "brand-collaboration",
          label: "Propose a custom brand collaboration",
        },
        { value: "product-donation", label: "Product or venue donation" },
        { value: "media-collab", label: "Media collaboration" },
      ],
    },
  },
  {
    value: "press",
    label: "Press & Media",
    subject: "Press Inquiry",
    description: "Interviews, filming requests, and media questions.",
    message: `${greeting}I'm reaching out with a press or media inquiry and would love to connect.\n`,
    messagePlaceholder: "What outlet are you with, and what's your deadline?",
    routeTo: DEFAULT_INBOX,
    detail: {
      label: "What kind of coverage?",
      options: [
        { value: "interview", label: "Interview request" },
        { value: "filming", label: "Filming or photography at a meetup" },
        { value: "press-kit", label: "Press kit or assets" },
        { value: "fact-check", label: "Fact check or correction" },
      ],
    },
  },
  {
    value: "cards",
    label: "Cards Order Support",
    subject: "Cards Order Support",
    description: "Include your order number if you have one.",
    message: `${greeting}I need help with a cards order and had a question about shipping, order details, or support.\n`,
    messagePlaceholder: "What's your order number, and what went wrong?",
    routeTo: DEFAULT_INBOX,
    detail: {
      label: "What's the issue?",
      options: [
        { value: "order-status", label: "Where is my order?" },
        { value: "shipping", label: "Shipping or address change" },
        { value: "damaged", label: "Damaged or wrong item" },
        { value: "refund", label: "Refund or exchange" },
        { value: "bulk-order", label: "Bulk or wholesale order" },
      ],
    },
  },
  {
    value: "join-team",
    label: "Volunteering & Joining the Team",
    subject: "Join the Team Inquiry",
    description: "Tell us which role you'd like to take on.",
    message: `${greeting}I'm interested in helping out and would love to learn more about joining the team.\n`,
    routeTo: DEFAULT_INBOX,
    detail: {
      label: "Which role interests you?",
      options: [
        { value: "volunteer-event", label: "Volunteer at events" },
        { value: "photography", label: "Photography or video" },
        { value: "design", label: "Design or social media" },
        { value: "engineering", label: "Website or engineering" },
        {
          value: "chapter-lead",
          label: "Lead a local chapter",
          routeTo: CHAPTERS_INBOX,
          messagePlaceholder:
            "Which city, and have you hosted a Ryan Meetup before?",
        },
        { value: "core-team", label: "Join the core Ryan team" },
        {
          value: "other-help",
          label: "A specific role",
          subject: "Specific role",
          followUp: {
            label: "What role do you have in mind?",
            placeholder: "DJ, MC, official Ryan hype man...",
          },
          messagePlaceholder: "What would you bring to the role?",
        },
      ],
    },
  },
  {
    value: "name-change",
    label: "Name Change Paperwork",
    subject: "Name Change Paperwork Request",
    description: "Help with legally becoming a Ryan.",
    message: `${greeting}I'm looking for help with name change paperwork and would like more information.\n`,
    routeTo: DEFAULT_INBOX,
  },
  {
    value: "awards",
    label: "Awards & Leaderboard",
    subject: "Awards / Leaderboard Update",
    description:
      "Missing attendance, wrong streak, or a name that needs fixing.",
    message: `${greeting}I think my awards or leaderboard information may need to be added or updated.\n`,
    messagePlaceholder: "Which Ryan and which meetups are we looking at?",
    routeTo: DEFAULT_INBOX,
    detail: {
      label: "What needs updating?",
      options: [
        { value: "missing-attendance", label: "Missing attendance" },
        { value: "wrong-count", label: "Wrong count or streak" },
        { value: "name-spelling", label: "Name or spelling fix" },
        { value: "remove-me", label: "Remove me from the leaderboard" },
      ],
    },
  },
  {
    value: "map",
    label: "Ryan Map Update",
    subject: "Map Update Request",
    description: "Add or correct a city on the Ryan map.",
    message: `${greeting}I'd like to request an update to the Ryan map and add or correct a city listing.\n`,
    routeTo: DEFAULT_INBOX,
  },
  {
    value: "other",
    label: "Something Else",
    subject: "Official Ryan Business",
    message: greeting,
    routeTo: DEFAULT_INBOX,
  },
];

/**
 * Prebuilt links for the CTAs scattered across the site. The `source` records
 * which page sent the Ryan over so replies land with context.
 */
const contactHrefs = {
  general: buildContactHref("general", { source: "general" }),
  sponsorship: buildContactHref("sponsorship", { source: "sponsors" }),
  monthlyBacker: buildContactHref("sponsorship", {
    detail: "monthly-backer",
    source: "sponsors",
  }),
  partnershipsMonthlyBacker: buildContactHref("sponsorship", {
    detail: "monthly-backer",
    source: "partnerships",
  }),
  eventSponsorship: buildContactHref("sponsorship", {
    detail: "event-sponsorship",
    source: "partnerships",
  }),
  brandCollaboration: buildContactHref("sponsorship", {
    detail: "brand-collaboration",
    source: "partnerships",
  }),
  press: buildContactHref("press", { source: "press" }),
  cardsSupport: `mailto:${CARDS_SUPPORT_INBOX}?${new URLSearchParams({
    subject: "RY-D Order Support",
    body: "Hi Ryan,\n\nOrder number:\nWhat I need help with:\n",
  })
    .toString()
    .replace(/\+/g, "%20")}`,
  joinTeam: buildContactHref("join-team", { source: "contribute" }),
  nameChangePaperwork: buildContactHref("name-change", {
    source: "name-change",
  }),
  awardsCorrection: buildContactHref("awards", {
    detail: "missing-attendance",
    source: "awards",
  }),
  mapUpdate: buildContactHref("map", { source: "map" }),
};

/**
 * Contact link for one Monthly Backer tier, with the tier and its price
 * already written into the subject and message so the visitor only has to
 * fill in the parts we cannot know.
 */
const buildMonthlyBackerTierHref = (slug: MonthlyBackerTierSlug) => {
  const tier = getMonthlyBackerTier(slug);
  if (!tier) return contactHrefs.partnershipsMonthlyBacker;

  const tierLabel = `${tier.name} ($${tier.price}/month)`;

  return buildContactHref("sponsorship", {
    detail: "monthly-backer",
    source: `partnerships:${tier.slug}`,
    subject: `Sponsorship Inquiry: ${tierLabel}`,
    message: `${greeting}I'm interested in becoming a Monthly Backer at the ${tierLabel} tier.\n\nBrand/company:\nWebsite:\nWhat we'd like to accomplish:\n`,
  });
};

export {
  buildContactHref,
  buildMonthlyBackerTierHref,
  CARDS_SUPPORT_INBOX,
  contactHrefs,
  contactTopics,
  DEFAULT_INBOX,
};
