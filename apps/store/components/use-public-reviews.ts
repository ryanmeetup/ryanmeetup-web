"use client";

import { useEffect, useRef, useState } from "react";
import { appendPublicReviews, productReviewPage, toReviewsData } from "@/lib/public-review-view";
import type { ReviewsData } from "@/lib/types";

function initialState(source: ReviewsData, productKey: string) {
  return { source, productKey, reviews: source.reviews, cursor: source.status === "available" ? source.pagination?.nextCursor ?? null : null,
    pending: false, error: "", message: "" };
}

/** Each initial server snapshot owns its pages; a refresh, product or provider change discards continuations. */
export function usePublicReviews(data: ReviewsData, productKey: string) {
  const [state, setState] = useState(() => initialState(data, productKey));
  const active = useRef<{ source: ReviewsData; productKey: string; controller: AbortController } | null>(null);
  if (state.source !== data || state.productKey !== productKey) setState(initialState(data, productKey));

  useEffect(() => () => {
    const operation = active.current;
    if (operation?.source === data && operation.productKey === productKey) operation.controller.abort();
  }, [data, productKey]);

  async function loadMore() {
    const productId = data.status === "available" ? data.pagination?.productId : undefined;
    if (!productId || !state.cursor || state.pending) return;
    const previous = active.current;
    if (previous?.source === data && previous.productKey === productKey && !previous.controller.signal.aborted) return;
    previous?.controller.abort();
    const operation = { source: data, productKey, controller: new AbortController() };
    active.current = operation;
    const matches = (current: typeof state) => current.source === data && current.productKey === productKey;
    setState((current) => matches(current) ? { ...current, pending: true, error: "", message: "" } : current);
    try {
      const query = new URLSearchParams({ productId, cursor: state.cursor });
      const response = await fetch(`/api/reviews/page?${query}`, { cache: "no-store", signal: operation.controller.signal });
      const page = response.ok ? productReviewPage(await response.json(), productId, state.cursor) : null;
      if (!page) throw new Error("Invalid public review page");
      const reviews = appendPublicReviews(state.reviews, toReviewsData(page).reviews);
      const added = reviews.length - state.reviews.length;
      if (page.nextCursor && added === 0) throw new Error("Public review page did not advance");
      if (!operation.controller.signal.aborted) setState((current) => matches(current) ? {
        ...current, reviews, cursor: page.nextCursor, pending: false,
        message: added ? `Loaded ${added} more review${added === 1 ? "" : "s"}.` : "No more reviews.",
      } : current);
    } catch {
      if (!operation.controller.signal.aborted) setState((current) => matches(current) ? {
        ...current, pending: false, error: "More reviews couldn't load. Please try again.",
      } : current);
    } finally {
      if (active.current === operation) active.current = null;
    }
  }

  return { ...state, loadMore };
}
