"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePagination, useQueryParamState } from "@ryanmeetup/hooks";
import {
  DEFAULT_REVIEW_VIEW, PUBLIC_REVIEW_PAGE_SIZE, REVIEW_PAGE_SIZE_OPTIONS, isRefinedReviewView, parseReviewView,
  reviewPageNumber, reviewViewKey, writeReviewView,
} from "@/lib/public-review-view";
import type { ReviewListPage, ReviewView, ReviewViewParams } from "@/lib/public-review-view";
import type { Review } from "@/lib/types";

type Loaded<T> = { source: object; key: string; view: ReviewView; page: ReviewListPage<T> };
type ReadPage<T> = (view: ReviewView, focusReviewId: string | null, signal: AbortSignal) => Promise<ReviewListPage<T>>;

const noSubscription = () => () => {};
/** False while hydrating, when URL hooks still report the server's empty query; true once the real URL is readable. */
const useHydrated = () => useSyncExternalStore(noSubscription, () => true, () => false);

/** Rewrites the list's parameters in one history entry, so a filter and its page reset land together. */
function replaceView(params: ReviewViewParams, view: ReviewView) {
  const url = new URL(window.location.href);
  writeReviewView(url.searchParams, view, params);
  window.history.replaceState(window.history.state, "", url);
}

/**
 * Numbered public review pages for product pages and the shop feed. The URL
 * holds the page, page size, filters and search; storage filters, sorts and
 * counts, so each request reads only the page on screen.
 */
export function usePublicReviewPages<T extends Review>({ source, params, initialView, initialPage, readPage }: {
  /** The server snapshot. A new one (another product design, a refresh) replaces everything loaded from the old one. */
  source: object;
  params: ReviewViewParams;
  /** The view the server rendered, so hydration shows it without a second read. */
  initialView: ReviewView;
  initialPage: ReviewListPage<T>;
  readPage: ReadPage<T>;
}) {
  const pagination = usePagination({
    pageParam: params.page, pageSizeParam: params.pageSize, defaultPageSize: PUBLIC_REVIEW_PAGE_SIZE,
    pageSizeOptions: REVIEW_PAGE_SIZE_OPTIONS, storageKey: "ryanmeetup.reviews.page-size",
  });
  const [rating] = useQueryParamState(params.rating);
  const [origin] = useQueryParamState(params.origin);
  const [sort] = useQueryParamState(params.sort);
  const [query] = useQueryParamState(params.query);
  const raw: Record<string, string> = {
    [params.page]: String(pagination.page), [params.pageSize]: String(pagination.pageSize),
    [params.rating]: rating, [params.origin]: origin, [params.sort]: sort, [params.query]: query,
  };
  const view = parseReviewView({ get: (name) => raw[name] || null }, params);
  const key = reviewViewKey(view);

  const [loaded, setLoaded] = useState<Loaded<T>>(() => ({ source, key: reviewViewKey(initialView), view: initialView, page: initialPage }));
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // A permalink read in flight owns the list until it lands.
  const focusing = useRef<{ reviewId: string; result: Promise<boolean | null> } | null>(null);
  const hydrated = useHydrated();
  const current = loaded.source === source ? loaded : { source, key: reviewViewKey(initialView), view: initialView, page: initialPage };
  if (loaded.source !== source) setLoaded(current);
  const pending = current.key !== key && !error;

  const read = useRef(readPage);
  const latestSource = useRef(source);
  useEffect(() => { read.current = readPage; latestSource.current = source; });

  useEffect(() => {
    if (!hydrated || current.key === key || focusing.current) return;
    const controller = new AbortController();
    read.current(view, null, controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      // A page past the end comes back as the last page; name that page in the URL.
      const served = { ...view, page: reviewPageNumber(page.offset, view.pageSize) };
      setError("");
      setLoaded({ source, key: reviewViewKey(served), view: served, page });
      if (served.page !== view.page) replaceView(params, served);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Reviews couldn't load. Please try again.");
    });
    return () => controller.abort();
    // `view` is fully described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key, current.key, source, attempt]);

  /** Filters, sorts and searches always start again at page one. */
  function changeView(patch: Partial<Omit<ReviewView, "page" | "pageSize">>) {
    setError("");
    replaceView(params, { ...view, ...patch, page: 1 });
  }

  /** Shows the page that holds one review, clearing filters that might hide it. Resolves whether it was found, or null when the read failed. */
  function focusReview(reviewId: string): Promise<boolean | null> {
    // Asking twice for the same review (a re-run effect) shares the read rather than racing it.
    if (focusing.current?.reviewId === reviewId) return focusing.current.result;
    const unfiltered = { ...DEFAULT_REVIEW_VIEW, pageSize: view.pageSize };
    const result = read.current(unfiltered, reviewId, new AbortController().signal).then((page) => {
      // Another product's list replaced this one while the read was out.
      if (latestSource.current !== source) return null;
      const served = { ...unfiltered, page: reviewPageNumber(page.offset, unfiltered.pageSize) };
      setError("");
      setLoaded({ source, key: reviewViewKey(served), view: served, page });
      replaceView(params, served);
      return page.reviews.some((review) => review.id === reviewId);
    }, () => {
      if (latestSource.current === source) setError("Reviews couldn't load. Please try again.");
      return null;
    }).finally(() => {
      if (focusing.current?.reviewId === reviewId) focusing.current = null;
    });
    focusing.current = { reviewId, result };
    return result;
  }

  return {
    view, reviews: current.page.reviews, total: current.page.total, pending, error,
    /** Paging controls stay disabled until hydration can act on them. */
    ready: hydrated,
    refined: isRefinedReviewView(view),
    page: current.view.page, pageSize: current.view.pageSize,
    changeView, focusReview,
    setPage: pagination.setPage, setPageSize: pagination.setPageSize,
    retry: () => { setError(""); setAttempt((value) => value + 1); },
  };
}
