"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Card, DisclosureCard, Heading, Text } from "@ryanmeetup/ui";
import { FiPackage } from "react-icons/fi";
import type { ReviewSuggestion, ReviewSuggestions as Suggestions } from "@/lib/review-suggestions";
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

const shippedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Variant options and order facts, one labelled line each. */
function SuggestionDetails({ item }: { item: ReviewSuggestion }) {
  const rows: { label: string; value: ReactNode }[] = [
    ...item.options.map((option) => ({ label: option.name ?? "Variant", value: option.value })),
    { label: "Order", value: item.orderUrl
      ? <a href={item.orderUrl} className="rounded-sm underline decoration-black/30 underline-offset-2 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:focus-visible:ring-white/40">{item.orderLabel}</a>
      : item.orderLabel },
    ...(item.shippedAt ? [{ label: "Shipped", value: shippedDate.format(new Date(item.shippedAt)) }] : []),
    ...(item.quantity > 1 ? [{ label: "Qty", value: item.quantity }] : []),
  ];
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-xs font-semibold uppercase tracking-caps-tight text-black/60 dark:text-white/60">{row.label}</dt>
          <dd className="min-w-0 text-sm text-black/80 wrap-anywhere dark:text-white/80">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
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
 * "Ready to review": the signed-in buyer's shipped purchases from recent
 * orders that they haven't reviewed. Each opens the review form already set
 * to that order, so reviewing doesn't mean finding the product first.
 */
export function ReviewSuggestions({ suggestions, onReviewed, photoViewerKey }: { suggestions: Suggestions; onReviewed: (message: string) => void; photoViewerKey?: string }) {
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
        summary={<SectionTitle title="Ready to review" count={`${items.length} item${items.length === 1 ? "" : "s"}`} />}
      >
      <Text className="text-sm">From your recent orders. Reviews of things you bought get a Verified badge.</Text>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.lineId}>
            <Card variant="outline" className="flex h-full items-start gap-4">
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
                </div>
                <SuggestionDetails item={item} />
                <Button size="sm" variant="secondary" fullWidth aria-label={`Write a review of ${item.productTitle}`} onClick={() => setReviewing(item)}>Write a review</Button>
              </div>
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
