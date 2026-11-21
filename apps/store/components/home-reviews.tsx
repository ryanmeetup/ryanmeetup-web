import { connection } from "next/server";
import { Button, SectionHeader } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";
import { getHomeReviews } from "@/lib/home-reviews";
import { PublicReviewCard } from "./public-review-card";

export async function HomeReviews() {
  // Review visibility changes must reach the next page request. The catalog
  // keeps its existing cache; review text is never frozen into the home shell.
  await connection();
  const reviews = await getHomeReviews();
  if (!reviews.length) return null;
  return <section aria-labelledby="home-reviews" className="store-container border-t border-black/10 pt-8 dark:border-white/10 sm:pt-12">
    <SectionHeader align="left" title={<span id="home-reviews">Recent reviews</span>}
      description="What buyers are saying about the merch."
      actions={<Button.Link href="/reviews" size="md" variant="secondary" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight aria-hidden />}>
        See all reviews
      </Button.Link>} />
    {/* Masonry via CSS columns: each card keeps its natural height, so short
        reviews no longer stretch to match a long neighbour. Order runs down
        each column, newest first. */}
    <ul aria-label="Latest customer reviews" className={`mt-8 gap-4 space-y-4 ${reviews.length === 1 ? "max-w-2xl" : "md:columns-2"} ${reviews.length > 2 ? "xl:columns-3" : ""}`}>
      {reviews.map(({ review, product }) => <li key={review.id} className="min-w-0 break-inside-avoid"><PublicReviewCard review={review} product={product} /></li>)}
    </ul>
  </section>;
}
