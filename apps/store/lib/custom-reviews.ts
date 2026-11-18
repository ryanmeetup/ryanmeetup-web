import type { PublicReviewPage } from "@ryanmeetup/reviews";
import { getReviewBackend } from "./review-backend";
import { publishedReviewPhotoUrl } from "./review-photo-hosts";
import type { ReviewsData } from "./types";

const unavailable: ReviewsData = { status: "unavailable", averageRating: 0, count: 0, reviews: [] };
const PAGE_SIZE = 20;

/** Shopify GIDs become the plain numeric IDs reviews are stored under. */
export function numericProductId(productId: string) {
  const id = productId.split("/").at(-1) ?? "";
  return /^[1-9][0-9]{0,19}$/.test(id) ? id : null;
}

/** Maps a public page to the storefront's review shape. Totals cover every published review. */
export function toReviewsData(page: PublicReviewPage): ReviewsData {
  return {
    status: "available",
    averageRating: page.summary.average,
    count: page.summary.count,
    reviews: page.reviews.map((review) => {
      // Only hosts next/image is configured for can render; add custom photo
      // storage to reviewPhotoHosts when it exists.
      const photoUrls = review.photos.flatMap((photo) => publishedReviewPhotoUrl(photo.url) ?? []);
      return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        reviewerName: review.displayName,
        createdAt: review.publishedAt,
        verified: review.verifiedPurchase,
        ...(photoUrls.length ? { photoUrls } : {}),
      };
    }),
  };
}

/**
 * Published custom reviews for one product. Any failure is reported as
 * unavailable, never as an empty success and never as Judge.me data.
 */
export async function getCustomReviews(productId: string, backend = getReviewBackend()): Promise<ReviewsData> {
  const id = numericProductId(productId);
  if (!backend || !id) return unavailable;
  try {
    return toReviewsData(await backend({ operation: "reviews.page", productIds: [id], limit: PAGE_SIZE, cursor: null }));
  } catch {
    return unavailable;
  }
}
