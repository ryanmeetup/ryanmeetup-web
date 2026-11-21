"use client";

import { Button, ErrorCallout, Heading, Text } from "@ryanmeetup/ui";
import type { ReviewFeedPage } from "@/lib/review-feed";
import { PublicReviewCard } from "./public-review-card";
import { PublicReviewFilters } from "./public-review-filters";
import { usePublicReviewPages } from "./use-public-review-pages";

function feedPage(value: unknown): ReviewFeedPage | null {
  if (!value || typeof value !== "object") return null;
  const { items, nextCursor } = value as Partial<ReviewFeedPage>;
  return Array.isArray(items) && (nextCursor === null || typeof nextCursor === "string") ? { items, nextCursor } : null;
}

// Keep each product attached through shared review sorting, filtering and paging.
const feedReviews = (page: ReviewFeedPage) => page.items.map(({ review, product }) => ({ ...review, product }));

/** Shop-wide public reviews, using the same controls and complete-list refinement as product pages. */
export function ReviewFeed({ initial }: { initial: ReviewFeedPage }) {
  const feed = usePublicReviewPages({
    source: initial,
    scopeKey: "shop",
    reviews: feedReviews(initial),
    cursor: initial.nextCursor,
    readPage: async (cursor, signal) => {
      const response = await fetch(`/api/reviews/feed?${new URLSearchParams({ cursor })}`, { cache: "no-store", signal });
      const page = response.ok ? feedPage(await response.json()) : null;
      if (!page) throw new Error("Invalid review feed page");
      return { reviews: feedReviews(page), nextCursor: page.nextCursor };
    },
  });

  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <PublicReviewFilters rating={feed.rating} sort={feed.sort} onChange={feed.changeView} />
      <Text role="status" className="text-sm" aria-live="polite">
        {feed.needsComplete ? (feed.pending ? "Loading reviews…" : "Finish loading to see matching reviews.") :
          feed.cursor ? `Showing ${feed.reviews.length} reviews` :
            `Showing ${feed.reviews.length} of ${feed.loadedCount} review${feed.loadedCount === 1 ? "" : "s"}`}
      </Text>
    </div>
    <div id="review-feed-results" role="region" aria-label="Review results" aria-busy={feed.pending}>
      {feed.needsComplete ? (
        <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
          <Heading size="h2" className="text-xl">{feed.pending ? "Finding matching reviews" : "More reviews to check"}</Heading>
          <Text className="mt-2">{feed.pending ? "Checking every published review across the shop." : "Try loading again to see all reviews that match."}</Text>
        </div>
      ) : feed.reviews.length ? (
        <ul id="review-feed" aria-label="Customer reviews" aria-busy={feed.pending} className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {feed.reviews.map(({ product, ...review }) => <li key={review.id} className="min-w-0"><PublicReviewCard review={review} product={product} /></li>)}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
          <Heading size="h2" className="text-xl">No reviews match this rating</Heading>
          <Text className="mt-2">Try another star rating or reset the filters to see every review.</Text>
        </div>
      )}
    </div>
    <div className="mt-6 space-y-3">
      {feed.cursor && <Button variant="secondary" className="w-full sm:w-auto" loading={feed.pending} loadingText="Loading reviews…"
        aria-label={feed.pending ? "Loading reviews…" : feed.error ? "Retry loading reviews" : "Load more reviews"}
        aria-controls="review-feed-results" onClick={() => void feed.loadMore()}>{feed.error ? "Retry loading reviews" : "Load more reviews"}</Button>}
      <div role="status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">{feed.pending ? "Loading more reviews…" : feed.message}</div>
      {feed.error && <ErrorCallout>{feed.error}</ErrorCallout>}
    </div>
  </>;
}
