import { connection } from "next/server";
import { Button, SectionHeader } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";
import { getHomeReviews } from "@/lib/home-reviews";
import { getReviewBackend } from "@/lib/review-backend";
import { getShopReviewSummary } from "@/lib/review-feed";
import { PublicReviewCard } from "./public-review-card";

export async function HomeReviews() {
  // Review visibility changes must reach the next page request. The catalog
  // keeps its existing cache; review text is never frozen into the home shell.
  await connection();
  const backend = getReviewBackend();
  const [reviews, summary] = await Promise.all([getHomeReviews({ backend }), getShopReviewSummary(backend)]);
  if (!reviews.length) return null;
  // Shop-wide published count, delisted products included, like the rows above. Omitted when it couldn't be read.
  const total = summary && Math.max(summary.count, reviews.length);
  return <section data-analytics-placement="home_reviews" data-analytics-section="home_reviews" aria-labelledby="home-reviews" className="store-container border-t border-black/10 pt-8 dark:border-white/10 sm:pt-12">
    <SectionHeader align="left" title={<span id="home-reviews">Recent reviews</span>}
      description="What buyers are saying about the merch."
      actions={<Button.Link href="/reviews" size="md" variant="secondary" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight aria-hidden />}>
        See all reviews
      </Button.Link>} />
    {/* Masonry, like the /reviews feed: each card keeps its own height and
        order runs down each column, newest first. */}
    <ul aria-label="Latest customer reviews" className={`mt-8 gap-4 ${reviews.length === 1 ? "max-w-2xl" : "md:columns-2"} ${reviews.length > 2 ? "xl:columns-3" : ""}`}>
      {reviews.map(({ review, product }) => <li key={review.id} className="mb-4 min-w-0 break-inside-avoid last:mb-0"><PublicReviewCard review={review} product={product} /></li>)}
    </ul>
    {total && <p className="mt-6 text-sm tabular-nums text-black/70 dark:text-white/70">
      Showing {reviews.length.toLocaleString("en-US")} of {total.toLocaleString("en-US")} review{total === 1 ? "" : "s"}
    </p>}
  </section>;
}
