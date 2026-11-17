import { getJudgeMeReviews } from "./judgeme-reviews";
import type { ReviewsData } from "./types";

/** Storefront entry point; provider details stay behind this boundary. */
export async function getReviews(productId: string): Promise<ReviewsData> {
  return getJudgeMeReviews(productId);
}
