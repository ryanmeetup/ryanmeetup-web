import { reviewResultSchema } from "@ryanmeetup/reviews";
import { getReviewBackend } from "./review-backend";
import type { ReviewBackend } from "./review-backend";
import { withReviewedProducts } from "./review-feed";
import { getProductCardsByIds } from "./shopify";

export async function getHomeReviews({ backend = getReviewBackend(), products = getProductCardsByIds }: {
  backend?: ReviewBackend | null; products?: typeof getProductCardsByIds;
} = {}) {
  if (!backend) return [];
  try {
    const result = reviewResultSchema("reviews.latest", { data: await backend({ operation: "reviews.latest" }) });
    return result ? await withReviewedProducts(result.data, products) : [];
  } catch { return []; }
}
