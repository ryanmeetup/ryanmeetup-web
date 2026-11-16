import { SITE_URL } from "@/utils/metadata";
import { createRedirectPage } from "@/utils/redirect";

const { metadata, RedirectPage } = createRedirectPage({
  url: "https://seatgeek.com/minnesota-wild-tickets/2-15-2027-saint-paul-minnesota-grand-casino-arena/nhl/18369618?sgo_ac=RYAN",
  metadata: {
    title: "Ryan Meetup - Minnesota Wild tickets",
    description: "Get Minnesota Wild tickets on SeatGeek.",
    canonical: `${SITE_URL}/wild`,
    image: {
      url: `${SITE_URL}/group-photos/ryankickoff.png`,
      width: 1600,
      height: 800,
    },
  },
});

export { metadata };
export default RedirectPage;
