import { reviewResultSchema } from "@ryanmeetup/reviews";
import { getReviewBackend } from "./review-backend";
import type { ReviewBackend } from "./review-backend";
import { getProductCardsByIds } from "./shopify";
import type { ProductCard } from "./shopify";
import { toReview } from "./public-review-view";
import { getProductHref } from "./product-groups";
import { reviewPermalink } from "./review-links";

export async function getHomeReviews({ backend = getReviewBackend(), products = getProductCardsByIds }: {
  backend?: ReviewBackend | null; products?: typeof getProductCardsByIds;
} = {}) {
  if (!backend) return [];
  try {
    const result = reviewResultSchema("reviews.latest", { data: await backend({ operation: "reviews.latest" }) });
    if (!result?.data.length) return [];
    const cards = await products([...new Set(result.data.map((review) => review.item.productId))]).catch(() => ({} as Record<string, ProductCard>));
    return result.data.map((review) => {
      const card = cards[review.item.productId];
      return { review: toReview(review), product: {
        title: card?.title ?? review.item.productTitle,
        href: card ? reviewPermalink("href" in card && typeof card.href === "string" ? card.href : getProductHref(card), review.id) : null,
      } };
    });
  } catch { return []; }
}
