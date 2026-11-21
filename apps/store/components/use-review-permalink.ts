"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { reviewAnchorId, reviewIdFromHash } from "@/lib/review-links";
import type { ReviewsData } from "@/lib/types";
import type { usePublicReviews } from "./use-public-reviews";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}
const readHash = () => reviewIdFromHash(window.location.hash);
const serverHash = () => null;

/** Resolve a permalink through the same approved-only pages as the public list. */
export function useReviewPermalink(data: ReviewsData, productKey: string, page: ReturnType<typeof usePublicReviews>) {
  const target = useSyncExternalStore(subscribeToHash, readHash, serverHash);
  const opened = useRef<{ target: string; productKey: string; data: ReviewsData } | null>(null);

  useEffect(() => {
    if (!target) {
      opened.current = null;
      return;
    }
    if ((opened.current?.target === target && opened.current.productKey === productKey && opened.current.data === data) ||
      data.status !== "available" || page.pending || page.error) return;
    // A newly opened permalink must remain visible even after filtering by rating.
    if (page.rating !== "all") {
      page.changeView({ rating: "all" });
      return;
    }
    const element = document.getElementById(reviewAnchorId(target));
    if (element) {
      opened.current = { target, productKey, data };
      element.scrollIntoView({ block: "start", behavior: "instant" });
      element.focus({ preventScroll: true });
    } else if (page.cursor) {
      void page.loadMore();
    }
  }, [data, productKey, target, page]);

  const missing = Boolean(target && data.status === "available" && page.rating === "all" &&
    !page.reviews.some((review) => review.id === target));
  return {
    finding: missing && Boolean(page.cursor) && !page.error,
    message: missing && !page.cursor && !page.pending && !page.error
      ? "This review is no longer available on this product page." : "",
  };
}
