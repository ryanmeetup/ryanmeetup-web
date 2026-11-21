"use client";

import { useEffect, useRef, useState } from "react";
import { appendPublicReviews, selectPublicReviews } from "@/lib/public-review-view";
import type { Review } from "@/lib/types";

function initialState<T extends Review>(source: object, scopeKey: string, reviews: T[], cursor: string | null) {
  return { source, scopeKey, reviews, cursor,
    rating: "all", sort: "newest", pending: false, error: "", message: "" };
}

/** Shared public paging for product reviews and the shop feed. Each server snapshot owns its cached pages and selections. */
export function usePublicReviewPages<T extends Review>({ source, scopeKey, reviews: initialReviews, cursor: initialCursor, readPage }: {
  source: object;
  scopeKey: string;
  reviews: T[];
  cursor: string | null;
  readPage: (cursor: string, signal: AbortSignal) => Promise<{ reviews: T[]; nextCursor: string | null }>;
}) {
  const [state, setState] = useState(() => initialState(source, scopeKey, initialReviews, initialCursor));
  const active = useRef<{ source: object; scopeKey: string; controller: AbortController; all: boolean } | null>(null);
  if (state.source !== source || state.scopeKey !== scopeKey) setState(initialState(source, scopeKey, initialReviews, initialCursor));

  useEffect(() => () => {
    const operation = active.current;
    if (operation?.source === source && operation.scopeKey === scopeKey) operation.controller.abort();
  }, [source, scopeKey]);

  async function loadMore(all = false) {
    if (!state.cursor) return;
    const previous = active.current;
    if (previous?.source === source && previous.scopeKey === scopeKey && !previous.controller.signal.aborted) {
      // A filter selected during a normal continuation upgrades that same read.
      previous.all ||= all;
      return;
    }
    previous?.controller.abort();
    const operation = { source, scopeKey, controller: new AbortController(), all };
    active.current = operation;
    const matches = (current: typeof state) => current.source === source && current.scopeKey === scopeKey;
    setState((current) => matches(current) ? { ...current, pending: true, error: "", message: "" } : current);
    try {
      let cursor: string | null = state.cursor;
      let reviews = state.reviews;
      do {
        const page = await readPage(cursor, operation.controller.signal);
        if (page.nextCursor === cursor) throw new Error("Public review page did not advance");
        const next = appendPublicReviews<T>(reviews, page.reviews);
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

  return { ...state, loadedCount: state.reviews.length, reviews: selectPublicReviews(state.reviews, state.rating, state.sort), needsComplete, refined,
    changeView, loadMore: () => loadMore(refined) };
}
