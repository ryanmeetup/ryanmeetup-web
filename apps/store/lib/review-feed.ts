import type { PublicReview } from "@ryanmeetup/reviews";
import { getProductHref } from "./product-groups";
import { readPublicReviewPage, readReviewPageRequest } from "./public-review-page";
import { DEFAULT_REVIEW_VIEW, toReview } from "./public-review-view";
import type { ReviewView } from "./public-review-view";
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
/** One numbered feed page: the served items, how many reviews match, and where the page starts. */
export type ReviewFeedPage = { items: ReviewFeedItem[]; total: number; offset: number };

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
 * One numbered page of published reviews across the shop, filtered, sorted
 * and searched by storage. Null means the read failed, so callers can say so
 * rather than show "no reviews".
 */
export async function getReviewFeedPage({ backend, view = DEFAULT_REVIEW_VIEW, products = getProductCardsByIds }: {
  backend: ReviewBackend | null; view?: ReviewView; products?: typeof getProductCardsByIds;
}): Promise<ReviewFeedPage | null> {
  const page = await readPublicReviewPage({ backend, productIds: null, view });
  return page && { items: await withReviewedProducts(page.reviews, products), total: page.total, offset: page.offset };
}

/** A numbered feed page for the /reviews controls. Anonymous, approved-only, and the page size is fixed. */
export async function handleReviewFeedPage(request: Request, { backend, products }: {
  backend: ReviewBackend | null; products?: typeof getProductCardsByIds;
}) {
  const parsed = readReviewPageRequest(new URL(request.url).searchParams);
  if (!parsed || parsed.focusReviewId) return privateJson(400, { error: "That review page could not be read." });
  const page = await getReviewFeedPage({ backend, view: parsed.view, products });
  return page ? privateJson(200, page) : privateJson(503, { error: "More reviews are temporarily unavailable. Please try again." });
}
