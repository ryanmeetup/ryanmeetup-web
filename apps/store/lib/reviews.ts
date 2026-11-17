import { getJudgeMeReviews } from "./judgeme-reviews";
import { getReviewProvider } from "./review-provider";
import type { ReviewsData } from "./types";

/** Storefront entry point; provider details stay behind this boundary. */
export async function getReviews(productId: string): Promise<ReviewsData> {
  if (getReviewProvider() === "judgeme") return getJudgeMeReviews(productId);

  // Custom persistence is not connected yet. Never substitute Judge.me data
  // or an empty-success response for an unavailable custom review store.
  return { status: "unavailable", averageRating: 0, count: 0, reviews: [] };
}
