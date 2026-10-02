import { SITE_URL } from "@/utils/metadata";
import { createRedirectPage } from "@/utils/redirect";

const { metadata, RedirectPage } = createRedirectPage({
  url: "https://forms.gle/Zyv93AV4okJ6jsUo6",
  metadata: {
    title: "Ryan Meetup - Card verification",
    description: "Verify your Ryan Meetup card.",
    canonical: `${SITE_URL}/cards/verify`,
    image: {
      url: `${SITE_URL}/group-photos/ryankickoff.png`,
      width: 1600,
      height: 800,
    },
  },
});

export { metadata };
export default RedirectPage;
