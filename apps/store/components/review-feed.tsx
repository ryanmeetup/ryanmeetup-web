"use client";

import { useRef, useState } from "react";
import { Button, ErrorCallout } from "@ryanmeetup/ui";
import type { ReviewFeedItem, ReviewFeedPage } from "@/lib/review-feed";
import { PublicReviewCard } from "./public-review-card";

function feedPage(value: unknown): ReviewFeedPage | null {
  if (!value || typeof value !== "object") return null;
  const { items, nextCursor } = value as Partial<ReviewFeedPage>;
  return Array.isArray(items) && (nextCursor === null || typeof nextCursor === "string") ? { items, nextCursor } : null;
}

/** Every published review across the shop, with "Load more" continuing the same newest-first order. */
export function ReviewFeed({ initial }: { initial: ReviewFeedPage }) {
  const [items, setItems] = useState<ReviewFeedItem[]>(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loading = useRef(false);

  async function loadMore() {
    if (!cursor || loading.current) return;
    loading.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/reviews/feed?${new URLSearchParams({ cursor })}`, { cache: "no-store" });
      const page = response.ok ? feedPage(await response.json()) : null;
      if (!page) throw new Error("Invalid review feed page");
      const seen = new Set(items.map((item) => item.review.id));
      const added = page.items.filter((item) => !seen.has(item.review.id));
      setItems([...items, ...added]);
      setCursor(page.nextCursor);
      setMessage(added.length ? `Loaded ${added.length} more review${added.length === 1 ? "" : "s"}.` : "No more reviews.");
    } catch {
      // Keep the cursor so trying again resumes at the page that failed.
      setError("More reviews didn't load. Please try again.");
    } finally {
      loading.current = false;
      setPending(false);
    }
  }

  return <>
    <ul id="review-feed" aria-label="Customer reviews" aria-busy={pending} className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(({ review, product }) => <li key={review.id} className="min-w-0"><PublicReviewCard review={review} product={product} /></li>)}
    </ul>
    <div className="mt-6 space-y-3">
      {cursor && <Button variant="secondary" className="w-full sm:w-auto" loading={pending} loadingText="Loading reviews…"
        aria-controls="review-feed" onClick={() => void loadMore()}>{error ? "Retry loading reviews" : "Load more reviews"}</Button>}
      <div role="status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">{pending ? "Loading more reviews…" : message}</div>
      {error && <ErrorCallout>{error}</ErrorCallout>}
    </div>
  </>;
}
