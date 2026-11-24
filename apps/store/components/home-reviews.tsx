import { Button, SectionHeader } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";
import { getHomeReviews } from "@/lib/home-reviews";
import { getReviewBackend } from "@/lib/review-backend";
import { getShopReviewSummary } from "@/lib/review-feed";
import { PublicReviewCard } from "./public-review-card";

export async function HomeReviews() {
  // Served from the home page's cache like the catalog: the backend caches these
  // reads for a minute and clears them when a buyer changes a review.
  const backend = getReviewBackend();
  const [reviews, summary] = await Promise.all([getHomeReviews({ backend }), getShopReviewSummary(backend)]);
  if (!reviews.length) return null;
  // Shop-wide published count, delisted products included, like the rows above. Omitted when it couldn't be read.
  const total = summary && Math.max(summary.count, reviews.length);
  const seeAll = (className?: string) => <Button.Link href="/reviews" size="md" variant="secondary" className={className} rightIcon={<FiArrowRight aria-hidden />}>
    See all reviews
  </Button.Link>;
  return <section data-analytics-placement="home_reviews" data-analytics-section="home_reviews" aria-labelledby="home-reviews" className="store-container border-t border-black/10 pt-8 dark:border-white/10 sm:pt-12">
    <SectionHeader align="left" title={<span id="home-reviews">Recent reviews</span>}
      description="What buyers are saying about the merch."
      // Phones reach the link after reading this batch, at the end of the
      // section; wider screens keep it beside the heading.
      actions={seeAll()} actionsClassName="max-sm:hidden" />
    {/* Masonry, like the /reviews feed: each card keeps its own height and
        order runs down each column, newest first. */}
    <ul aria-label="Latest customer reviews" className={`mt-8 gap-4 ${reviews.length === 1 ? "max-w-2xl" : "md:columns-2"} ${reviews.length > 2 ? "xl:columns-3" : ""}`}>
      {reviews.map(({ review, product }) => <li key={review.id} className="mb-4 min-w-0 break-inside-avoid last:mb-0"><PublicReviewCard review={review} product={product} /></li>)}
    </ul>
    {total && <p className="mt-6 text-sm tabular-nums text-black/70 dark:text-white/70">
      Showing {reviews.length.toLocaleString("en-US")} of {total.toLocaleString("en-US")} review{total === 1 ? "" : "s"}
    </p>}
    <div className="mt-6 sm:hidden">{seeAll("!w-full")}</div>
  </section>;
}
