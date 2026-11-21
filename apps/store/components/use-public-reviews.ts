"use client";

import { publicReviewSearchPageSchema } from "@ryanmeetup/reviews";
import { DEFAULT_REVIEW_VIEW, FEED_REVIEW_PARAMS, PRODUCT_REVIEW_PARAMS, toReview, writeReviewView } from "@/lib/public-review-view";
import type { ReviewsData } from "@/lib/types";
import { usePublicReviewPages } from "./use-public-review-pages";

const noReviews = { reviews: [], total: 0, offset: 0 };

/** A product's numbered review pages. The server renders the first, unfiltered page; later reads go through the public API. */
export function usePublicReviews(data: ReviewsData) {
  const productId = data.status === "available" ? data.productId : undefined;
  return usePublicReviewPages({
    source: data,
    params: PRODUCT_REVIEW_PARAMS,
    initialView: DEFAULT_REVIEW_VIEW,
    initialPage: data.status === "available" ? { reviews: data.reviews, total: data.count, offset: 0 } : noReviews,
    readPage: async (view, focusReviewId, signal) => {
      if (!productId) throw new Error("Missing review product");
      // The API takes the same readable names as the /reviews URL.
      const query = writeReviewView(new URLSearchParams({ productId }), view, FEED_REVIEW_PARAMS);
      if (focusReviewId) query.set("review", focusReviewId);
      const response = await fetch(`/api/reviews/page?${query}`, { cache: "no-store", signal });
      const page = response.ok ? publicReviewSearchPageSchema(await response.json()) : null;
      if (!page || page.reviews.some((review) => review.item.productId !== productId)) throw new Error("Invalid public review page");
      return { reviews: page.reviews.map(toReview), total: page.total, offset: page.offset };
    },
  });
}
