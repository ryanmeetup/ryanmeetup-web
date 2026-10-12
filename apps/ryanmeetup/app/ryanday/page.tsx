// Utilities
import { createRedirectPage } from "@/utils/redirect";

const { metadata, RedirectPage } = createRedirectPage({
  url: "https://partiful.com/e/52AEebHoL4MkLoQbPKaE?c=oV8JR0Ko",
  metadata: {
    title: "Ryan Meetup - Ryan Day",
    description: "RSVP to Ryan Day with Ryan Meetup.",
    canonical: "https://ryanmeetup.com/ryanday",
    image: {
      url: "https://ryanmeetup.com/group-photos/ryankickoff.png",
      width: 1600,
      height: 800,
    },
    keywords: [
      "ryan day",
      "ryan meetup ryan day",
      "ryan day rsvp",
      "ryan meetup partiful",
    ],
  },
});

export { metadata };
export default RedirectPage;
