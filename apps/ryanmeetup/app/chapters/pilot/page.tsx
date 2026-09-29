// Utilities
import { createRedirectPage } from "@/utils/redirect";

const { metadata, RedirectPage } = createRedirectPage({
  url: "https://docs.google.com/document/d/1iJb9DYWPmT8mWeUMw3Da9qCpyPRtDPkfP5w6F4HapqA/edit?tab=t.0",
  metadata: {
    title: "Ryan Meetup - Chapter Pilot",
    description: "Learn about the Ryan Meetup chapter pilot program.",
    canonical: "https://ryanmeetup.com/chapters/pilot",
    image: {
      url: "https://ryanmeetup.com/meta/chapters.jpg",
      width: 1600,
      height: 900,
    },
    keywords: [
      "ryan meetup chapter pilot",
      "ryan meetup chapters program",
      "start a ryan meetup chapter",
    ],
    robots: {
      index: false,
      follow: false,
    },
  },
});

export { metadata };
export default RedirectPage;
