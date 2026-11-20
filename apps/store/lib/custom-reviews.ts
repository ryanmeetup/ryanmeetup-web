import { getReviewBackend } from "./review-backend";
import { PUBLIC_REVIEW_PAGE_SIZE, toReviewsData } from "./public-review-view";
import type { ReviewsData } from "./types";

const unavailable: ReviewsData = { status: "unavailable", averageRating: 0, count: 0, reviews: [] };

/** Shopify GIDs become the plain numeric IDs reviews are stored under. */
export function numericProductId(productId: string) {
  const id = productId.split("/").at(-1) ?? "";
  return /^[1-9][0-9]{0,19}$/.test(id) ? id : null;
}

/**
 * Published custom reviews for one product. Any failure is reported as
 * unavailable, never as an empty success.
 */
export async function getCustomReviews(productId: string, backend = getReviewBackend()): Promise<ReviewsData> {
  const id = numericProductId(productId);
  if (!backend || !id) return unavailable;
  try {
    return toReviewsData(await backend({ operation: "reviews.page", productIds: [id], limit: PUBLIC_REVIEW_PAGE_SIZE, cursor: null }));
  } catch {
    return unavailable;
  }
}
