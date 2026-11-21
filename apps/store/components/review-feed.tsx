"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button, ErrorCallout, FilterBar, Heading, PendingResults, SearchInput, Text } from "@ryanmeetup/ui";
import { FEED_REVIEW_PARAMS, writeReviewView } from "@/lib/public-review-view";
import type { ReviewView } from "@/lib/public-review-view";
import type { ReviewFeedPage } from "@/lib/review-feed";
import { PublicReviewCard } from "./public-review-card";
import { PublicReviewFilters } from "./public-review-filters";
import { ReviewCardSkeletons } from "./review-card-skeletons";
import { ReviewPagination } from "./review-pagination";
import { usePublicReviewPages } from "./use-public-review-pages";

const RESULTS_ID = "review-feed-results";
const SEARCH_DEBOUNCE_MS = 300;

function feedPage(value: unknown): ReviewFeedPage | null {
  if (!value || typeof value !== "object") return null;
  const { items, total, offset } = value as Partial<ReviewFeedPage>;
  return Array.isArray(items) && Number.isSafeInteger(total) && Number.isSafeInteger(offset) ? { items, total: total!, offset: offset! } : null;
}

// Keep each product attached to its review card.
const feedReviews = (page: ReviewFeedPage) => ({
  reviews: page.items.map(({ review, product }) => ({ ...review, product })), total: page.total, offset: page.offset,
});

/** Shop-wide public reviews in numbered pages. Storage searches, filters and sorts, so every page agrees. */
export function ReviewFeed({ initial, initialView }: { initial: ReviewFeedPage; initialView: ReviewView }) {
  const feed = usePublicReviewPages({
    source: initial,
    params: FEED_REVIEW_PARAMS,
    initialView,
    initialPage: feedReviews(initial),
    readPage: async (view, _focus, signal) => {
      const query = writeReviewView(new URLSearchParams(), view, FEED_REVIEW_PARAMS);
      const response = await fetch(`/api/reviews/feed?${query}`, { cache: "no-store", signal });
      const page = response.ok ? feedPage(await response.json()) : null;
      if (!page) throw new Error("Invalid review feed page");
      return feedReviews(page);
    },
  });

  // The box updates as the reader types; the URL, and the read, follow once they pause.
  const applied = feed.view.query;
  const [input, setInput] = useState(applied);
  const [syncedQuery, setSyncedQuery] = useState(applied);
  if (syncedQuery !== applied) {
    // Back/forward or a reset changed the applied search; keep the box in step without trimming mid-typing.
    setSyncedQuery(applied);
    if (input.trim() !== applied) setInput(applied);
  }
  const typing = input.trim() !== applied;
  const commitSearch = useEffectEvent(() => feed.changeView({ query: input.trim() }));
  useEffect(() => {
    if (!typing) return;
    const timer = window.setTimeout(commitSearch, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input, typing]);

  const { reviews, view } = feed;
  return <>
    <FilterBar
      search={<SearchInput label="Search reviews" name="review-search" value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Search by review, reviewer, or product..."
        pending={typing || feed.pending} pendingLabel="Loading review results"
        aria-controls={RESULTS_ID} />}
      actions={<PublicReviewFilters rating={view.rating} sort={view.sort} origin={view.origin} onChange={feed.changeView} />} />
    <div id={RESULTS_ID} role="region" aria-label="Review results" aria-busy={feed.pending || typing} className="scroll-mt-24">
      <PendingResults pending={typing} label="Searching reviews" surface="page">
        {feed.pending ? (
          <ReviewCardSkeletons label="Finding matching reviews" columns="md:columns-2 xl:columns-3" />
        ) : reviews.length ? (
          <ul id="review-feed" aria-label="Customer reviews" className="gap-4 md:columns-2 xl:columns-3">
            {/* Masonry: cards keep their own height, filling each column top to bottom. */}
            {reviews.map(({ product, ...review }) => <li key={review.id} className="mb-4 min-w-0 break-inside-avoid last:mb-0"><PublicReviewCard review={review} product={product} /></li>)}
          </ul>
        ) : view.query ? (
          <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h2" className="text-xl">No reviews match your search</Heading>
            <Text className="mt-2">Not even one Ryan said that. Try different words, another star rating or source, or clear the search.</Text>
            <Button variant="secondary" size="sm" className="mt-4 w-full sm:w-auto" onClick={() => { setInput(""); feed.changeView({ query: "" }); }}>Clear search</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h2" className="text-xl">No reviews match these filters</Heading>
            <Text className="mt-2">Try another star rating or source, or reset the filters to see every review.</Text>
          </div>
        )}
      </PendingResults>
    </div>
    {feed.error && <div className="mt-6 space-y-3">
      <ErrorCallout>{feed.error}</ErrorCallout>
      <Button variant="secondary" className="w-full sm:w-auto" aria-controls={RESULTS_ID} onClick={feed.retry}>Retry loading reviews</Button>
    </div>}
    <ReviewPagination resultsId={RESULTS_ID} page={feed.page} pageSize={feed.pageSize} total={feed.total} pending={feed.pending || !feed.ready}
      onPageChange={feed.setPage} onPageSizeChange={feed.setPageSize} />
  </>;
}
