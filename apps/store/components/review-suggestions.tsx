"use client";

import { useState } from "react";
import { Button, Card, DisclosureCard, Heading, Text } from "@ryanmeetup/ui";
import type { ReviewSuggestion, ReviewSuggestions as Suggestions } from "@/lib/review-suggestions";
import { ReviewItemDetails, ReviewItemThumbnail, ReviewItemTitle, reviewItemDate, variantRows, type ReviewItemRow } from "./review-item";
import { CustomReviewComposer, type CustomReviewResult, type CustomReviewSubmission } from "./custom-review-composer";

/**
 * A section title with its count beside the arrow, matching the collapsible
 * collections on /collections/all.
 */
export function SectionTitle({ title, count }: { title: string; count: string }) {
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="min-w-0 font-cooper text-2xl">{title}</span>
      <span className="whitespace-nowrap font-sans text-xs font-semibold tracking-normal text-black/70 dark:text-white/70">{count}</span>
    </span>
  );
}

/** The toggle row both My reviews sections share, so they read as one page. */
export const reviewSectionToggle = "flex w-full items-center justify-between gap-4 rounded-sm py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:focus-visible:ring-white/40";

/** Variant options and order facts, one labelled line each. */
function suggestionRows(item: ReviewSuggestion): ReviewItemRow[] {
  return [
    ...variantRows(item.options),
    { label: "Order", value: item.orderUrl
      ? <a href={item.orderUrl} className="rounded-sm font-mono underline decoration-black/30 underline-offset-2 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:focus-visible:ring-white/40">{item.orderLabel}</a>
      : <span className="font-mono">{item.orderLabel}</span> },
    ...(item.shippedAt ? [{ label: "Shipped", value: reviewItemDate.format(new Date(item.shippedAt)) }] : []),
  ];
}

/** The same review request a product page sends; the server rechecks the purchase. */
async function submit(item: ReviewSuggestion, {viewerKey,...review}: CustomReviewSubmission): Promise<CustomReviewResult> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(viewerKey ? {"X-Review-Viewer":viewerKey} : {}) },
    body: JSON.stringify({ ...review, productId: item.productId, lineId: item.lineId }),
  }).catch(() => null);
  const payload = (await response?.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
  if (!response?.ok) return { ok: false, error: typeof payload?.error === "string" ? payload.error : "Your review could not be submitted. Please try again.", refreshRequired:payload?.code === "viewer_changed" };
  return { ok: true, message: "Thanks! Your review is waiting for approval." };
}

/**
 * "Ready to Review": the signed-in buyer's shipped purchases from recent
 * orders that they haven't reviewed. Each opens the review form already set
 * to that order, so reviewing doesn't mean finding the product first.
 */
export function ReviewSuggestions({ suggestions, onReviewed, photoViewerKey, submitReview = submit }: {
  suggestions: Suggestions; onReviewed: (message: string) => void; photoViewerKey?: string;
  submitReview?: (item: ReviewSuggestion, review: CustomReviewSubmission) => Promise<CustomReviewResult>;
}) {
  const [items, setItems] = useState(suggestions.items);
  const [reviewing, setReviewing] = useState<ReviewSuggestion | null>(null);
  if (!items.length) return null;

  return (
    <section aria-labelledby="ready-to-review">
      <DisclosureCard
        id="ready-to-review"
        heading="h2"
        defaultOpen
        className="border-b border-black/10 dark:border-white/10"
        buttonClassName={reviewSectionToggle}
        panelClassName="space-y-4 pb-6"
        summary={<SectionTitle title="Ready to Review" count={`${items.length} item${items.length === 1 ? "" : "s"}`} />}
      >
      <Text className="text-sm">Fellow Ryans are counting on you. A few words on how it fits, feels, and holds up help the next Ryan pick with confidence.</Text>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.lineId}>
            <Card variant="outline" className="flex h-full flex-col gap-4">
              <div className="flex items-start gap-4">
                <ReviewItemThumbnail href={item.href} image={item.image} />
                <div className="min-w-0 flex-1 space-y-2">
                  <Heading size="h3" className="text-base wrap-anywhere"><ReviewItemTitle href={item.href}>{item.productTitle}</ReviewItemTitle></Heading>
                  <ReviewItemDetails rows={suggestionRows(item)} />
                </div>
              </div>
              {/* Pinned to the bottom so buttons line up across a row of cards. */}
              <Button size="sm" variant="secondary" fullWidth className="mt-auto" aria-label={`Write a review of ${item.productTitle}`} onClick={() => setReviewing(item)}>Write a review</Button>
            </Card>
          </li>
        ))}
      </ul>
      </DisclosureCard>
      {reviewing && (
        <CustomReviewComposer
          key={reviewing.lineId}
          open
          photos={photoViewerKey ? {productId:reviewing.productId,viewerKey:photoViewerKey} : undefined}
          access={{ status: "ready", buyer: suggestions.buyer, purchases: [{ lineId: reviewing.lineId, label: reviewing.label, orderLabel: reviewing.orderLabel, options: reviewing.options }], defaultNameStyle: "first-initial" }}
          product={{ title: reviewing.productTitle, featuredImage: reviewing.image ? { ...reviewing.image, width: null, height: null } : null }}
          onClose={() => setReviewing(null)}
          onSubmit={async (review) => {
            const result = await submitReview(reviewing, review);
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
