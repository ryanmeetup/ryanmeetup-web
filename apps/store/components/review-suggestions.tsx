"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Heading, Text } from "@ryanmeetup/ui";
import { FiPackage } from "react-icons/fi";
import type { ReviewSuggestion, ReviewSuggestions as Suggestions } from "@/lib/review-suggestions";
import { CustomReviewComposer, type CustomReviewResult } from "./custom-review-composer";

/** The same review request a product page sends; the server rechecks the purchase. */
async function submit(item: ReviewSuggestion, review: Record<string, unknown>): Promise<CustomReviewResult> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...review, productId: item.productId, lineId: item.lineId }),
  }).catch(() => null);
  const payload = (await response?.json().catch(() => null)) as { error?: unknown } | null;
  if (!response?.ok) return { ok: false, error: typeof payload?.error === "string" ? payload.error : "Your review could not be submitted. Please try again." };
  return { ok: true, message: "Thanks! Your review is waiting for approval." };
}

/**
 * "Ready to review": the signed-in buyer's shipped purchases from recent
 * orders that they haven't reviewed. Each opens the review form already set
 * to that order, so reviewing doesn't mean finding the product first.
 */
export function ReviewSuggestions({ suggestions, onReviewed }: { suggestions: Suggestions; onReviewed: (message: string) => void }) {
  const [items, setItems] = useState(suggestions.items);
  const [reviewing, setReviewing] = useState<ReviewSuggestion | null>(null);
  if (!items.length) return null;

  return (
    <section aria-labelledby="ready-to-review" className="space-y-4">
      <div className="space-y-1">
        <Heading id="ready-to-review" size="h2" className="text-2xl">Ready to review</Heading>
        <Text className="text-sm">From your recent orders. Reviews of things you bought get a Verified badge.</Text>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.lineId}>
            <Card variant="outline" className="flex h-full items-center gap-4">
              <Link href={item.href} className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40" tabIndex={-1} aria-hidden>
                {item.image
                  ? <Image src={item.image.url} alt="" width={64} height={64} sizes="64px" className="size-16 rounded-lg object-cover" />
                  : <span className="flex size-16 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10"><FiPackage className="size-5 text-black/60 dark:text-white/60" /></span>}
              </Link>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="min-w-0">
                  <Heading size="h3" className="text-base wrap-anywhere">
                    <Link href={item.href} className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40">{item.productTitle}</Link>
                  </Heading>
                  <Text className="text-sm wrap-anywhere">{item.label}</Text>
                </div>
                <Button size="sm" variant="secondary" className="w-full sm:w-auto" aria-label={`Write a review of ${item.productTitle}`} onClick={() => setReviewing(item)}>Write a review</Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {reviewing && (
        <CustomReviewComposer
          key={reviewing.lineId}
          open
          access={{ status: "ready", buyer: suggestions.buyer, purchases: [{ lineId: reviewing.lineId, label: reviewing.label }], defaultNameStyle: "first-initial" }}
          product={{ title: reviewing.productTitle, featuredImage: reviewing.image ? { ...reviewing.image, width: null, height: null } : null }}
          onClose={() => setReviewing(null)}
          onSubmit={async (review) => {
            const result = await submit(reviewing, review);
            if (result.ok) {
              setItems((current) => current.filter((item) => item.lineId !== reviewing.lineId));
              onReviewed(result.message);
            }
            return result;
          }}
        />
      )}
    </section>
  );
}
