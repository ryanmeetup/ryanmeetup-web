import { connection } from "next/server";
import { Breadcrumbs, Heading, Text } from "@ryanmeetup/ui";
import { FiStar } from "react-icons/fi";
import { ReviewFeed } from "@/components/review-feed";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";
import { StoreHomeIcon } from "@/lib/navigation";
import { getReviewBackend } from "@/lib/review-backend";
import { getReviewFeedPage } from "@/lib/review-feed";

export const metadata = buildPageMetadata({
  title: "Customer Reviews",
  description: "Every published review from across the Ryan Meetup store, newest first.",
  canonical: "/reviews",
  image: DEFAULT_IMAGE,
});

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20 sm:p-10">
    <Heading size="h2" className="text-xl">{title}</Heading>
    <Text className="mt-2">{children}</Text>
  </div>;
}

/** Every published review across the shop. A buyer's own reviews live at /reviews/mine. */
export default async function ReviewsPage() {
  // Moderation and withdrawals must reach the next request; review text is never cached into the page.
  await connection();
  const page = await getReviewFeedPage({ backend: getReviewBackend() });
  return (
    <main className="store-container space-y-8 py-10 sm:py-14">
      <div>
        <Breadcrumbs variant="compact" crumbs={[
          { href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> },
          { href: "/reviews", title: "Reviews", current: true, icon: <FiStar aria-hidden className="shrink-0" /> },
        ]} />
        <Heading size="h1" className="mt-3 text-4xl sm:text-5xl">Customer Reviews</Heading>
        <Text className="mt-3 max-w-prose">Every published review from across the shop, newest first.</Text>
      </div>
      {!page ? <Notice title="Reviews are taking a short break">We couldn&apos;t load reviews just now. Please try again in a few minutes.</Notice>
        : !page.items.length ? <Notice title="No reviews yet">The first official Ryan review is still out there. Check back soon.</Notice>
        : <ReviewFeed initial={page} />}
    </main>
  );
}
