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
    <SectionHeader align="left" title={<span id="home-reviews">Fresh from the Ryans</span>}
      description="The latest reviews from across the shop."
      actions={<Button.Link href="/reviews" size="md" variant="secondary" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight aria-hidden />}>
        See all reviews
      </Button.Link>} />
    <ul aria-label="Latest customer reviews" className={`mt-8 grid items-stretch gap-4 ${reviews.length === 1 ? "max-w-2xl" : "md:grid-cols-2"} ${reviews.length > 2 ? "xl:grid-cols-3" : ""}`}>
      {reviews.map(({ review, product }) => <li key={review.id} className="min-w-0"><PublicReviewCard review={review} product={product} /></li>)}
    </ul>
  </section>;
}
