import { SITE_URL } from "@/utils/metadata";
import { createRedirectPage } from "@/utils/redirect";

const { metadata, RedirectPage } = createRedirectPage({
  url: "https://partiful.com/e/P5vBoqdijeznyyCOVfTp?",
  metadata: {
    title: "Ryan Meetup - Minnesota Wild meetup",
    description: "RSVP for the Minnesota Wild meetup on Partiful.",
    canonical: `${SITE_URL}/hockey`,
    image: {
      url: `${SITE_URL}/group-photos/ryankickoff.png`,
      width: 1600,
      height: 800,
    },
  },
});

export { metadata };
export default RedirectPage;
