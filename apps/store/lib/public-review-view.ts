import { decodeReviewCursor, publicReviewPageSchema } from "@ryanmeetup/reviews";
import type { PublicReview, PublicReviewPage } from "@ryanmeetup/reviews";
import { publishedReviewPhotoUrl } from "./review-photo-hosts";
import type { Review, ReviewsData } from "./types";

export const PUBLIC_REVIEW_PAGE_SIZE = 20;

export const REVIEW_RATING_OPTIONS = [
  { value: "all", label: "All ratings" },
  ...[5, 4, 3, 2, 1].map((rating) => ({ value: String(rating), label: `${rating} star${rating === 1 ? "" : "s"}` })),
];
export const REVIEW_SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export function selectPublicReviews<T extends Review>(reviews: T[], rating: string, sort: string): T[] {
  return reviews.filter((review) => rating === "all" || String(review.rating) === rating).sort((a, b) => {
    const newest = Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id);
    if (sort === "oldest") return -newest;
    if (sort === "highest") return b.rating - a.rating || newest;
    if (sort === "lowest") return a.rating - b.rating || newest;
    return newest;
  });
}

/** The same public fields and approved photo paths in every Store review card. */
export function toReview(review: PublicReview): Review {
  const photoUrls = review.photos.flatMap((photo) => publishedReviewPhotoUrl(photo.url) ?? []);
  return {
    id: review.id, rating: review.rating, title: review.title, body: review.body,
    reviewerName: review.displayName, createdAt: review.publishedAt,
    verification: review.verifiedPurchase ? "purchase" as const : null,
    ...(photoUrls.length ? { photoUrls } : {}),
    ...(review.reply ? { reply: { body: review.reply.body, publishedAt: review.reply.publishedAt } } : {}),
  };
}

/** Shared server/browser projection; no database client or buyer data belongs here. */
export function toReviewsData(page: PublicReviewPage): Extract<ReviewsData, { status: "available" }> {
  return {
    status: "available",
    averageRating: page.summary.average,
    count: page.summary.count,
    reviews: page.reviews.map(toReview),
    ...(page.nextCursor && page.scope.productIds.length === 1 ? {
      pagination: { productId: page.scope.productIds[0], nextCursor: page.nextCursor },
    } : {}),
  };
}

/** A continuation must remain public, bounded, scoped to this product and able to advance. */
export function productReviewPage(value: unknown, productId: string, after: string | null): PublicReviewPage | null {
  const page = publicReviewPageSchema(value);
  if (!page || page.scope.productIds.length !== 1 || page.scope.productIds[0] !== productId ||
    page.reviews.length > PUBLIC_REVIEW_PAGE_SIZE) return null;
  if (page.nextCursor !== null) {
    const cursor = decodeReviewCursor(page.nextCursor);
    const last = page.reviews.at(-1);
    if (!cursor || page.nextCursor === after || !last || cursor.id !== last.id || cursor.publishedAt !== last.publishedAt) return null;
  }
  return page;
}

/** Keep first-seen order while refreshing overlapping public rows, without duplicate cards. */
export function appendPublicReviews<T extends Review>(current: T[], next: T[]): T[] {
  const reviews = new Map(current.map((review) => [review.id, review]));
  for (const review of next) reviews.set(review.id, review);
  return [...reviews.values()];
}
