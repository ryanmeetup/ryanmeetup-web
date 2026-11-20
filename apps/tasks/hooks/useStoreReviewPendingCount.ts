"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const CHANGED_EVENT = "tasks:store-reviews-changed";

/**
 * Tell the sidebar to re-count waiting reviews, after a moderation decision or
 * an attempt whose outcome is unknown, so the badge never waits for the next
 * navigation to drop.
 */
export function notifyStoreReviewsChanged() {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * Reviews waiting for a decision, for the sidebar badge. `null` until the
 * first answer, and again whenever the count cannot be read, so a failed
 * request shows no badge rather than a stale or invented number.
 *
 * Re-counts on navigation, when the tab regains focus, and after a decision.
 */
export function useStoreReviewPendingCount(enabled: boolean) {
  const pathname = usePathname();
  const [pending, setPending] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const bump = () => setRevision((current) => current + 1);
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener(CHANGED_EVENT, bump);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(CHANGED_EVENT, bump);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch("/api/admin/reviews/pending-count", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body: unknown = response.ok ? await response.json() : null;
        const count =
          body && typeof body === "object" && "pending" in body
            ? body.pending
            : null;
        setPending(
          typeof count === "number" && Number.isSafeInteger(count) && count >= 0
            ? count
            : null,
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setPending(null);
        if (!(error instanceof DOMException && error.name === "AbortError"))
          console.warn("Pending review count failed");
      });
    return () => controller.abort();
  }, [enabled, pathname, revision]);

  return enabled ? pending : null;
}
