"use client";

import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";
import { Button, ErrorCallout, FilterBar, Heading, PendingResults, SearchInput, Text } from "@ryanmeetup/ui";
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
type FeedReview = ReturnType<typeof feedReviews>[number];

const SEARCH_PARAM = "q";
// Keep the search placeholder in step with these fields ("review" covers title and body).
const reviewHaystack = ({ title, body, reviewerName, product }: FeedReview) =>
  [title, body, reviewerName, product.title].join(" ").toLowerCase();

/** Shop-wide public reviews, using the same controls and complete-list refinement as product pages. */
export function ReviewFeed({ initial }: { initial: ReviewFeedPage }) {
  // The settled query lives in the URL; a search, like a rating, must see every page before it can say what matches.
  const [appliedQuery] = useQueryParamState(SEARCH_PARAM);
  const searching = appliedQuery.trim() !== "";
  const feed = usePublicReviewPages({
    source: initial,
    scopeKey: "shop",
    reviews: feedReviews(initial),
    cursor: initial.nextCursor,
    searching,
    readPage: async (cursor, signal) => {
      const response = await fetch(`/api/reviews/feed?${new URLSearchParams({ cursor })}`, { cache: "no-store", signal });
      const page = response.ok ? feedPage(await response.json()) : null;
      if (!page) throw new Error("Invalid review feed page");
      return { reviews: feedReviews(page), nextCursor: page.nextCursor };
    },
  });
  const search = useSearchFilter({ data: feed.reviews, buildHaystack: reviewHaystack, queryParam: SEARCH_PARAM });
  const reviews = search.filtered;
  const finding = feed.needsComplete && feed.pending;

  return <>
    <FilterBar
      search={<SearchInput label="Search reviews" name="review-search" value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        placeholder="Search by review, reviewer, or product..."
        pending={search.isPending || finding} pendingLabel="Loading review results"
        aria-controls="review-feed-results" />}
      actions={<PublicReviewFilters rating={feed.rating} sort={feed.sort} origin={feed.origin} onChange={feed.changeView} />} />
    <div id="review-feed-results" role="region" aria-label="Review results" aria-busy={feed.pending || search.isPending}>
      <PendingResults pending={search.isPending} label="Searching reviews" surface="page">
        {feed.needsComplete ? (
          <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h2" className="text-xl">{feed.pending ? "Finding matching reviews" : "More reviews to check"}</Heading>
            <Text className="mt-2">{feed.pending ? "Checking every published review across the shop." : "Try loading again to see all reviews that match."}</Text>
          </div>
        ) : reviews.length ? (
          <ul id="review-feed" aria-label="Customer reviews" aria-busy={feed.pending} className="gap-4 md:columns-2 xl:columns-3">
            {/* Masonry: cards keep their own height, filling each column top to bottom. */}
            {reviews.map(({ product, ...review }) => <li key={review.id} className="mb-4 min-w-0 break-inside-avoid last:mb-0"><PublicReviewCard review={review} product={product} /></li>)}
          </ul>
        ) : searching ? (
          <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h2" className="text-xl">No reviews match your search</Heading>
            <Text className="mt-2">Not even one Ryan said that. Try different words, another star rating or source, or clear the search.</Text>
            <Button variant="secondary" size="sm" className="mt-4 w-full sm:w-auto" onClick={() => search.setQuery("")}>Clear search</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h2" className="text-xl">No reviews match these filters</Heading>
            <Text className="mt-2">Try another star rating or source, or reset the filters to see every review.</Text>
          </div>
        )}
      </PendingResults>
    </div>
    <div className="mt-6 space-y-3">
      {/* The count describes paging, so it sits with the control that pages.
          Empty and still-loading states already speak from the results area. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Text role="status" aria-live="polite" className="text-sm">
          {feed.needsComplete || !reviews.length ? "" : feed.cursor ? `Showing ${reviews.length} reviews` :
            `Showing ${reviews.length} of ${feed.loadedCount} review${feed.loadedCount === 1 ? "" : "s"}`}
        </Text>
        {feed.cursor && <Button variant="secondary" className="w-full sm:w-auto" loading={feed.pending} loadingText="Loading reviews…"
          aria-label={feed.pending ? "Loading reviews…" : feed.error ? "Retry loading reviews" : "Load more reviews"}
          aria-controls="review-feed-results" onClick={() => void feed.loadMore()}>{feed.error ? "Retry loading reviews" : "Load more reviews"}</Button>}
      </div>
      <div role="status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">{feed.pending ? "Loading more reviews…" : feed.message}</div>
      {feed.error && <ErrorCallout>{feed.error}</ErrorCallout>}
    </div>
  </>;
}
