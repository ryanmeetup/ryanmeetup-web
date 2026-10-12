// Utilities
import { createRedirectPage } from "@/utils/redirect";

const { metadata, RedirectPage } = createRedirectPage({
  url: "https://meet.google.com/smt-ubsk-aeo",
  metadata: {
    title: "Ryan Meetup - Join Ryan Day",
    description: "Join the Ryan Day Google Meet with Ryan Meetup.",
    canonical: "https://ryanmeetup.com/ryanday/join",
    image: {
      url: "https://ryanmeetup.com/group-photos/ryankickoff.png",
      width: 1600,
      height: 800,
    },
    keywords: [
      "ryan day",
      "ryan day google meet",
      "join ryan day",
      "ryan meetup video call",
    ],
  },
});

export { metadata };
export default RedirectPage;
