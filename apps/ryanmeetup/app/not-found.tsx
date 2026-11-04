// Components
import { Layout } from "@/components/navigation";
import { PageNotFound } from "@/components/global";

// Types
import { buildPageMetadata, SITE_URL } from "@/utils/metadata";

export const metadata = buildPageMetadata({
  title: "Page not found | Ryan Meetup",
  description: "We couldn’t find this page. Find a meetup or head back to Ryan Meetup.",
  canonical: SITE_URL,
  robots: { index: false, follow: true },
  image: {
    url: "https://ryanmeetup.com/group-photos/ryanroundup.png",
    width: 3284,
    height: 2189,
  },
});

const NotFoundPage = () => {
  return (
    <Layout>
      <PageNotFound />
    </Layout>
  );
};

export default NotFoundPage;
