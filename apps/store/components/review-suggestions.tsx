"use client";

import { useState } from "react";
import { Button, Card, DisclosureCard, ErrorCallout, Heading, surfaceTriggerClassNames, Text } from "@ryanmeetup/ui";
import type { ReviewSuggestion, ReviewSuggestions as Suggestions } from "@/lib/review-suggestions";
import { ReviewItemDetails, ReviewItemThumbnail, ReviewItemTitle, reviewItemDate, variantRows, type ReviewItemRow } from "./review-item";
import { submitCustomReview } from "@/lib/custom-review-client";
import { CustomReviewComposer, type CustomReviewResult, type CustomReviewSubmission } from "./custom-review-composer";
import { useReviewSuggestions, type ChangeReviewSuggestion } from "./use-review-suggestions";

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

/** The same review request a product page sends, for this card's order line. */
const submit = (item: ReviewSuggestion, review: CustomReviewSubmission) => submitCustomReview({ ...review, productId: item.productId, lineId: item.lineId });

/**
 * "Ready to Review": the signed-in buyer's shipped purchases from recent
 * orders that they haven't reviewed. Each opens the review form already set
 * to that order, so reviewing doesn't mean finding the product first.
 */
export function ReviewSuggestions({ suggestions, onReviewed, viewerKey, photoViewerKey, submitReview = submit, changeSuggestion, routes = false }: {
  suggestions: Suggestions; onReviewed: (message: string) => void; photoViewerKey?: string;
  /** Link phones to each purchase's review route instead of opening the dialog. */
  routes?: boolean;
  viewerKey: string; changeSuggestion?: ChangeReviewSuggestion;
  submitReview?: (item: ReviewSuggestion, review: CustomReviewSubmission) => Promise<CustomReviewResult>;
}) {
  const reminders = useReviewSuggestions(suggestions, viewerKey, changeSuggestion);
  const [reviewing, setReviewing] = useState<ReviewSuggestion | null>(null);
  if (!reminders.ready.length && !reminders.dismissed.length) return null;

  function cards(items: ReviewSuggestion[], dismissed = false) {
    return <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy={Boolean(reminders.pending)}>
      {items.map((item) => <li key={item.lineId}>
        <Card variant="outline" className="flex h-full flex-col gap-4">
          <div className="flex items-start gap-4">
            <ReviewItemThumbnail href={item.href} image={item.image} />
            <div className="min-w-0 flex-1 space-y-2">
              <Heading size="h3" className="text-base wrap-anywhere"><ReviewItemTitle href={item.href}>{item.productTitle}</ReviewItemTitle></Heading>
              <ReviewItemDetails rows={suggestionRows(item)} />
            </div>
          </div>
          <div className="mt-auto flex gap-2">
            {dismissed
              ? <Button size="sm" variant="secondary" fullWidth disabled={Boolean(reminders.pending)} loading={reminders.pending === item.lineId}
                  aria-label={`Restore review reminder for ${item.productTitle}`} onClick={() => void reminders.update(item.lineId, "restore")}>Restore reminder</Button>
              : <>
                {routes && item.reviewHref && <Button.Link href={item.reviewHref} prefetch={false} size="sm" variant="secondary" fullWidth className={surfaceTriggerClassNames.route}
                  aria-label={`Write a review of ${item.productTitle}`}>Write a review</Button.Link>}
                <Button size="sm" variant="secondary" fullWidth className={routes && item.reviewHref ? surfaceTriggerClassNames.dialog : undefined} disabled={Boolean(reminders.pending)} aria-label={`Write a review of ${item.productTitle}`} onClick={() => setReviewing(item)}>Write a review</Button>
                <Button size="sm" variant="ghost" disabled={Boolean(reminders.pending)} loading={reminders.pending === item.lineId}
                  aria-label={`Dismiss review reminder for ${item.productTitle}`} onClick={() => void reminders.update(item.lineId, "dismiss")}>Dismiss</Button>
              </>}
          </div>
        </Card>
      </li>)}
    </ul>;
  }

  return (
    <section aria-labelledby="ready-to-review">
      <DisclosureCard
        id="ready-to-review"
        heading="h2"
        defaultOpen
        className="border-b border-black/10 dark:border-white/10"
        buttonClassName={reviewSectionToggle}
        panelClassName="space-y-4 pb-6"
        summary={<SectionTitle title="Ready to Review" count={`${reminders.ready.length} item${reminders.ready.length === 1 ? "" : "s"}`} />}
      >
      {Boolean(reminders.ready.length) && <Text className="text-sm">Fellow Ryans are counting on you. A few words on how it fits, feels, and holds up help the next Ryan pick with confidence.</Text>}
      <Text className="text-sm">Not feeling it? Dismiss a reminder to stop seeing it for that purchase. You can restore it below; other purchases will still appear.</Text>
      <div role="status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">{reminders.pending ? "Updating your review reminders…" : reminders.message}</div>
      {reminders.error && <ErrorCallout>{reminders.error}</ErrorCallout>}
      {reminders.ready.length ? cards(reminders.ready) : <Text className="text-sm">No purchases waiting for a review.</Text>}
      {Boolean(reminders.dismissed.length) && <DisclosureCard heading="h3" className="border-t border-black/10 dark:border-white/10"
        buttonClassName={reviewSectionToggle} panelClassName="space-y-4 pb-2"
        summary={<span className="font-sans text-sm font-semibold">Dismissed ({reminders.dismissed.length})</span>}>
        {cards(reminders.dismissed, true)}
      </DisclosureCard>}
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
              reminders.reviewed(reviewing.lineId);
              onReviewed(result.message);
            }
            return result;
          }}
        />
      )}
    </section>
  );
}
