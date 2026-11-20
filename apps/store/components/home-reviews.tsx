import { connection } from "next/server";
import { SectionHeader } from "@ryanmeetup/ui";
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
      description="The latest reviews from across the shop." />
    <ul aria-label="Latest customer reviews" className="mt-8 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reviews.map(({ review, product }) => <li key={review.id} className="min-w-0"><PublicReviewCard review={review} product={product} /></li>)}
    </ul>
  </section>;
}
