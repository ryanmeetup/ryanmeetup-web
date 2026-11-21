import { decodeReviewCursor, reviewResultSchema } from "@ryanmeetup/reviews";
import type { PublicReview } from "@ryanmeetup/reviews";
import { getProductHref } from "./product-groups";
import { PUBLIC_REVIEW_PAGE_SIZE, toReview } from "./public-review-view";
import { privateJson } from "./request-guard";
import type { ReviewBackend } from "./review-backend";
import { getProductCardsByIds } from "./shopify";
import type { ProductCard } from "./shopify";
import type { Review } from "./types";

/**
 * A public review with the product it reviews, linked to that product's page
 * (not the review's anchor: the reader has just read the review and wants the
 * item) when the product still exists.
 */
export type ReviewFeedItem = { review: Review; product: { title: string; href: string | null } };
export type ReviewFeedPage = { items: ReviewFeedItem[]; nextCursor: string | null };

/**
 * Pairs public reviews with their current product titles and links. A product
 * lookup failure keeps the review's stored title rather than dropping it.
 */
export async function withReviewedProducts(reviews: PublicReview[], products: typeof getProductCardsByIds = getProductCardsByIds): Promise<ReviewFeedItem[]> {
  if (!reviews.length) return [];
  const cards = await products([...new Set(reviews.map((review) => review.item.productId))]).catch(() => ({} as Record<string, ProductCard>));
  return reviews.map((review) => {
    const card = cards[review.item.productId];
    return { review: toReview(review), product: {
      title: card?.title ?? review.item.productTitle,
      href: card ? ("href" in card && typeof card.href === "string" ? card.href : getProductHref(card)) : null,
    } };
  });
}

/**
 * One page of every published review across the shop, newest first. Null
 * means the read failed, so callers can say so rather than show "no reviews".
 */
export async function getReviewFeedPage({ backend, cursor = null, products = getProductCardsByIds }: {
  backend: ReviewBackend | null; cursor?: string | null; products?: typeof getProductCardsByIds;
}): Promise<ReviewFeedPage | null> {
  if (!backend || (cursor !== null && !decodeReviewCursor(cursor))) return null;
  try {
    const result = reviewResultSchema("reviews.feed", { data: await backend({ operation: "reviews.feed", limit: PUBLIC_REVIEW_PAGE_SIZE, cursor }) });
    // A continuation that cannot advance would loop the "Load more" button.
    if (!result || (result.data.nextCursor !== null && result.data.nextCursor === cursor)) return null;
    return { items: await withReviewedProducts(result.data.reviews, products), nextCursor: result.data.nextCursor };
  } catch { return null; }
}

/** The next page of the shop-wide feed for "Load more". Anonymous, approved-only, and the page size is fixed. */
export async function handleReviewFeedPage(request: Request, { backend, products }: {
  backend: ReviewBackend | null; products?: typeof getProductCardsByIds;
}) {
  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor");
  if ([...params.keys()].some((key) => key !== "cursor") || params.getAll("cursor").length !== 1 || !cursor || !decodeReviewCursor(cursor)) {
    return privateJson(400, { error: "That review page could not be read." });
  }
  const page = await getReviewFeedPage({ backend, cursor, products });
  return page ? privateJson(200, page) : privateJson(503, { error: "More reviews are temporarily unavailable. Please try again." });
}
