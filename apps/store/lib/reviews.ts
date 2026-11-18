import { getCustomReviews } from "./custom-reviews";
import { getJudgeMeReviews } from "./judgeme-reviews";
import { getActiveReviewProvider } from "./review-preview";
import type { ReviewsData } from "./types";

/** Storefront entry point; provider details stay behind this boundary. */
export async function getReviews(productId: string): Promise<ReviewsData> {
  if (await getActiveReviewProvider() === "judgeme") return getJudgeMeReviews(productId);

  // Never substitute Judge.me data or an empty-success response for an
  // unavailable custom review store; getCustomReviews reports unavailable.
  return getCustomReviews(productId);
}
