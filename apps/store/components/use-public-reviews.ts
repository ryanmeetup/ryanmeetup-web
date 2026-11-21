"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicReviewPage } from "@ryanmeetup/reviews";
import { appendPublicReviews, productReviewPage, selectPublicReviews, toReviewsData } from "@/lib/public-review-view";
import type { ReviewsData } from "@/lib/types";

function initialState(source: ReviewsData, productKey: string) {
  return { source, productKey, reviews: source.reviews, cursor: source.status === "available" ? source.pagination?.nextCursor ?? null : null,
    rating: "all", sort: "newest", pending: false, error: "", message: "" };
}

/** Each initial server snapshot owns its pages; a refresh, product or provider change discards continuations. */
export function usePublicReviews(data: ReviewsData, productKey: string) {
  const [state, setState] = useState(() => initialState(data, productKey));
  const active = useRef<{ source: ReviewsData; productKey: string; controller: AbortController; all: boolean } | null>(null);
  if (state.source !== data || state.productKey !== productKey) setState(initialState(data, productKey));

  useEffect(() => () => {
    const operation = active.current;
    if (operation?.source === data && operation.productKey === productKey) operation.controller.abort();
  }, [data, productKey]);

  async function loadMore(all = false) {
    const productId = data.status === "available" ? data.pagination?.productId : undefined;
    if (!productId || !state.cursor) return;
    const previous = active.current;
    if (previous?.source === data && previous.productKey === productKey && !previous.controller.signal.aborted) {
      // A filter selected during a normal continuation upgrades that same read.
      previous.all ||= all;
      return;
    }
    previous?.controller.abort();
    const operation = { source: data, productKey, controller: new AbortController(), all };
    active.current = operation;
    const matches = (current: typeof state) => current.source === data && current.productKey === productKey;
    setState((current) => matches(current) ? { ...current, pending: true, error: "", message: "" } : current);
    try {
      let cursor: string | null = state.cursor;
      let reviews = state.reviews;
      do {
        const query: URLSearchParams = new URLSearchParams({ productId, cursor });
        const response: Response = await fetch(`/api/reviews/page?${query}`, { cache: "no-store", signal: operation.controller.signal });
        const page: PublicReviewPage | null = response.ok ? productReviewPage(await response.json(), productId, cursor) : null;
        if (!page) throw new Error("Invalid public review page");
        const next = appendPublicReviews(reviews, toReviewsData(page).reviews);
        if (page.nextCursor && next.length === reviews.length) throw new Error("Public review page did not advance");
        reviews = next;
        cursor = page.nextCursor;
        if (operation.controller.signal.aborted) return;
        const added = reviews.length - state.reviews.length;
        const pending = operation.all && cursor !== null;
        // Retain completed pages on failure so a retry resumes at the failed page.
        const snapshot = { reviews, cursor, pending };
        setState((current) => matches(current) ? {
          ...current, ...snapshot,
          message: pending ? "" : added ? `Loaded ${added} more review${added === 1 ? "" : "s"}.` : "No more reviews.",
        } : current);
      } while (operation.all && cursor);
    } catch {
      if (!operation.controller.signal.aborted) setState((current) => matches(current) ? {
        ...current, pending: false, error: "More reviews couldn't load. Please try again.",
      } : current);
    } finally {
      if (active.current === operation) active.current = null;
    }
  }

  const refined = state.rating !== "all" || state.sort !== "newest";
  const needsComplete = refined && state.cursor !== null;

  function changeView(view: { rating?: string; sort?: string }) {
    const next = { rating: state.rating, sort: state.sort, ...view };
    setState((current) => ({ ...current, ...next, message: "" }));
    // Sorting or filtering only the first page would hide matching older reviews.
    // Reuse the approved-only endpoint and cache the remaining pages for this snapshot.
    if (next.rating !== "all" || next.sort !== "newest") void loadMore(true);
  }

  return { ...state, reviews: selectPublicReviews(state.reviews, state.rating, state.sort), needsComplete, refined,
    changeView, loadMore: () => loadMore(refined) };
}
