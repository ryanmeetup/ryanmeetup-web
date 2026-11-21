"use client";

import { productReviewPage, toReviewsData } from "@/lib/public-review-view";
import type { ReviewsData } from "@/lib/types";
import { usePublicReviewPages } from "./use-public-review-pages";

export function usePublicReviews(data: ReviewsData, productKey: string) {
  const productId = data.status === "available" ? data.pagination?.productId : undefined;
  return usePublicReviewPages({
    source: data,
    scopeKey: productKey,
    reviews: data.reviews,
    cursor: data.status === "available" ? data.pagination?.nextCursor ?? null : null,
    readPage: async (cursor, signal) => {
      if (!productId) throw new Error("Missing review product");
      const query = new URLSearchParams({ productId, cursor });
      const response = await fetch(`/api/reviews/page?${query}`, { cache: "no-store", signal });
      const page = response.ok ? productReviewPage(await response.json(), productId, cursor) : null;
      if (!page) throw new Error("Invalid public review page");
      return { reviews: toReviewsData(page).reviews, nextCursor: page.nextCursor };
    },
  });
}
