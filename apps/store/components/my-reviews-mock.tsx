"use client";

import { useState } from "react";
import type { BuyerReview, ReviewSubmission } from "@ryanmeetup/reviews";
import type { MyReviewProduct, MyReviewView } from "@/lib/my-review-view";
import { sampleDisplayName } from "@/lib/my-reviews-samples";
import type { ReviewSuggestion, ReviewSuggestions } from "@/lib/review-suggestions";
import type { CustomReviewResult } from "./custom-review-composer";
import { MyReviews } from "./my-reviews";
import type { MyReviewsClient } from "./use-my-reviews";

const PAGE_SIZE = 50;
const VIEWER_KEY = "0".repeat(64);
const pause = () => new Promise((resolve) => setTimeout(resolve, 450));
/** A database-shaped version: milliseconds plus three more digits. */
const stamp = () => new Date().toISOString().replace(/Z$/, "123Z");
const current = (review: ReviewSubmission) => ({ rating: review.rating, title: review.title, body: review.body, nameStyle: review.nameStyle, displayName: sampleDisplayName(review.nameStyle) });

/** An in-memory stand-in for the My reviews API, shaped like its responses. */
function mockBackend(seed: BuyerReview[], products: Record<string, MyReviewProduct>, buyerName: MyReviewView["buyerName"]) {
  let reviews = seed;
  let created = 0;
  const view = (cursor: string | null = null): MyReviewView => {
    const start = cursor ? Number(cursor) : 0;
    return { page: { reviews: reviews.slice(start, start + PAGE_SIZE), nextCursor: start + PAGE_SIZE < reviews.length ? String(start + PAGE_SIZE) : null },
      products, buyerName, viewerKey: VIEWER_KEY };
  };
  const client: MyReviewsClient = {
    async fetch(cursor) { await pause(); return view(cursor ?? null); },
    async change(change) {
      await pause();
      reviews = reviews.map((review) => {
        if (review.id !== change.reviewId) return review;
        if (change.action === "withdraw") return { ...review, status: "withdrawn", hasPendingEdit: false, publishedAt: null, updatedAt: stamp() };
        const live = review.status === "published";
        return { ...review, status: live ? "published" : "pending", hasPendingEdit: live, updatedAt: stamp(), current: current(change) };
      });
    },
  };
  async function submit(item: ReviewSuggestion, review: ReviewSubmission & { lineId: string | null }): Promise<CustomReviewResult> {
    await pause();
    const n = 700 + ++created;
    reviews = [{
      id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, lineId: item.lineId, status: "pending", hasPendingEdit: false, publishedAt: null,
      item: { productId: item.productId.split("/").pop()!, productTitle: item.productTitle, variantTitle: item.options.map((option) => option.value).join(" / ") || null },
      createdAt: stamp(), updatedAt: stamp(), current: current(review),
    }, ...reviews];
    return { ok: true, message: "Thanks! Your review is waiting for approval." };
  }
  return { view, client, submit };
}

/**
 * Dev-only: My reviews over in-memory sample data, so every view can be
 * clicked through on localhost without signing in. Edits, withdrawals, new
 * reviews and paging behave like the live API and reset on reload. With
 * `failFirstLoad`, the page starts in its load-error state and Refresh recovers.
 */
export function MyReviewsMock({ reviews, products, suggestions, failFirstLoad = false }: {
  reviews: BuyerReview[]; products: Record<string, MyReviewProduct>; suggestions: ReviewSuggestions | null; failFirstLoad?: boolean;
}) {
  const [backend] = useState(() => mockBackend(reviews, products, suggestions?.buyer ?? null));
  const [initial] = useState(() => failFirstLoad ? null : backend.view());
  return <MyReviews initial={initial} suggestions={suggestions} client={backend.client} submitReview={backend.submit} />;
}
