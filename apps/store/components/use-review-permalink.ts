"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

/** Opens a permalinked review: on screen already, or the page storage says holds it, through the same approved-only reads. */
export function useReviewPermalink(data: ReviewsData, list: ReturnType<typeof usePublicReviews>) {
  const target = useSyncExternalStore(subscribeToHash, readHash, serverHash);
  const opened = useRef<{ target: string; data: ReviewsData } | null>(null);
  const looked = useRef<{ target: string; data: ReviewsData } | null>(null);
  const [lookup, setLookup] = useState<{ target: string; status: "finding" | "missing" } | null>(null);
  const { reviews, pending, error, focusReview } = list;

  useEffect(() => {
    if (!target) {
      opened.current = null;
      looked.current = null;
      return;
    }
    if ((opened.current?.target === target && opened.current.data === data) || data.status !== "available" || pending || error) return;
    const element = document.getElementById(reviewAnchorId(target));
    if (element) {
      opened.current = { target, data };
      element.scrollIntoView({ block: "start", behavior: "instant" });
      element.focus({ preventScroll: true });
      return;
    }
    if (looked.current?.target === target && looked.current.data === data) return;
    looked.current = { target, data };
    setLookup({ target, status: "finding" });
    void focusReview(target).then((found) => {
      // A failed read is not a missing review: the retry that clears the error looks again.
      if (found === null) looked.current = null;
      setLookup(found === false ? { target, status: "missing" } : null);
    });
  }, [data, target, reviews, pending, error, focusReview]);

  const current = lookup?.target === target ? lookup.status : null;
  return {
    target,
    finding: current === "finding",
    message: current === "missing" ? "This review is no longer available on this product page." : "",
  };
}
