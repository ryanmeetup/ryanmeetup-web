import { connection } from "next/server";
import { Breadcrumbs, Button, Heading, Text } from "@ryanmeetup/ui";
import { FiMessageSquare, FiStar } from "react-icons/fi";
import { ReviewFeed } from "@/components/review-feed";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";
import { StoreHomeIcon } from "@/lib/navigation";
import { getReviewBackend } from "@/lib/review-backend";
import { FEED_REVIEW_PARAMS, isRefinedReviewView, parseReviewView, reviewPageNumber } from "@/lib/public-review-view";
import { getReviewFeedPage } from "@/lib/review-feed";

export const metadata = buildPageMetadata({
  title: "Customer Reviews",
  description: "Explore published reviews from across the Ryan Meetup store. Search them, filter by star rating or source, or sort by date and rating.",
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
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Moderation and withdrawals must reach the next request; review text is never cached into the page.
  await connection();
  const query = await searchParams;
  // A shared link renders the page it names; anything unreadable falls back to the first, unfiltered page.
  const view = parseReviewView({ get: (name) => { const value = query[name]; return typeof value === "string" ? value : null; } }, FEED_REVIEW_PARAMS);
  const page = await getReviewFeedPage({ backend: getReviewBackend(), view });
  return (
    <main className="store-container space-y-8 py-10 sm:py-14">
      <div>
        <Breadcrumbs variant="compact" crumbs={[
          { href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> },
          { href: "/reviews", title: "Reviews", current: true, icon: <FiStar aria-hidden className="shrink-0" /> },
        ]} />
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Heading size="h1" className="text-4xl sm:text-5xl">Customer Reviews</Heading>
            <Text className="mt-3 max-w-prose">Every published review from across the shop.</Text>
          </div>
          <Button.Link href="/reviews/mine" variant="secondary" size="md" leftIcon={<FiMessageSquare aria-hidden />} className="w-full shrink-0 sm:w-auto">My reviews</Button.Link>
        </div>
      </div>
      {!page ? <Notice title="Reviews are taking a short break">We couldn&apos;t load reviews just now. Please try again in a few minutes.</Notice>
        : !page.total && !isRefinedReviewView(view) ? <Notice title="No reviews yet">The first official Ryan review is still out there. Check back soon.</Notice>
        : <ReviewFeed initial={page} initialView={{ ...view, page: reviewPageNumber(page.offset, view.pageSize) }} />}
    </main>
  );
}
