"use client";

import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trackStoreEvent } from "@/lib/analytics";
import { Button, ErrorCallout, Heading, RatingStars, SuccessCallout, Text } from "@ryanmeetup/ui";
import type { Product, ReviewsData } from "@/lib/types";
import type { CustomReviewAccess } from "@/lib/custom-review-access";
import { PRODUCT_REVIEW_PARAMS } from "@/lib/public-review-view";
import { CustomReviewComposer, type CustomReviewResult, type CustomReviewSubmission } from "./custom-review-composer";
import { PublicReviewCard } from "./public-review-card";
import { PublicReviewFilters } from "./public-review-filters";
import { ReviewCardSkeletons } from "./review-card-skeletons";
import { ReviewPagination } from "./review-pagination";
import { usePublicReviews } from "./use-public-reviews";
import { useReviewPermalink } from "./use-review-permalink";

function RatingSummary({ data, className = "" }: { data: ReviewsData; className?: string }) {
  if (data.status === "unavailable") {
    return <Text className={`text-sm ${className}`}>Reviews are temporarily unavailable.</Text>;
  }
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/70 dark:text-white/70 ${className}`}>
      <RatingStars rating={data.averageRating} />
      <span>{data.count ? `Average rating from ${data.count} review${data.count === 1 ? "" : "s"}` : "No reviews yet"}</span>
    </div>
  );
}

async function submitCustomReview({viewerKey,...review}: CustomReviewSubmission & { productId: string }): Promise<CustomReviewResult> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(viewerKey ? {"X-Review-Viewer":viewerKey} : {}) },
    body: JSON.stringify(review),
  });
  const payload = (await response.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
  if (!response.ok) return { ok: false, error: typeof payload?.error === "string" ? payload.error : "Your review could not be submitted. Please try again.", refreshRequired:payload?.code === "viewer_changed" };
  return { ok: true, message: "Thanks! Your review is waiting for approval." };
}

export function Reviews({ data, product, access }: { data: ReviewsData; product: Pick<Product, "id" | "title" | "featuredImage">; access: CustomReviewAccess }) {
  const formId = useId();
  const publicReviews = usePublicReviews(data);
  const permalink = useReviewPermalink(data, publicReviews);
  // Null outside the App Router, such as when rendered directly in unit tests.
  const searchParams = useSearchParams();
  const linkedToReviews = Object.values(PRODUCT_REVIEW_PARAMS).some((name) => searchParams?.has(name) ?? false);
  const [showAll, setShowAll] = useState(linkedToReviews);
  // Explicit review links and filters keep their existing full, paginated view.
  const expanded = showAll || Boolean(permalink.target) || linkedToReviews || publicReviews.refined;
  const visibleReviews = expanded ? publicReviews.reviews : publicReviews.reviews.slice(0, 4);
  const resultsId = `${formId}-results`;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <section data-analytics-placement="reviews" data-analytics-section="reviews" id="reviews" className="border-t border-black/10 py-16 dark:border-white/10 sm:py-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Heading size="h2" className="text-3xl sm:text-4xl">{data.status === "available" && !data.count ? "The Ryans have not spoken... yet" : "The Ryans have spoken"}</Heading>
          <RatingSummary data={data} className="mt-3" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-start lg:max-w-xs lg:items-end lg:text-right">
          <Button size="sm" variant="secondary" className="w-full sm:w-auto" disabled={access.status === "unavailable"} onClick={() => { setMessage(""); setOpen(true); trackStoreEvent("review_composer_opened", { access: access.status }); }}>Write a review</Button>
          {access.status === "unavailable" && <Text className="text-sm">Review collection is temporarily unavailable. Please try again later.</Text>}
        </div>
      </div>

      <div aria-live="polite">
        {message && <SuccessCallout className="mt-6" title="Review received" dismissLabel="Dismiss review confirmation" onDismiss={() => setMessage("")}>{message}</SuccessCallout>}
      </div>
      <CustomReviewComposer
        access={access}
        product={product}
        open={open}
        photos={access.status === "ready" ? access.photos : undefined}
        onClose={() => setOpen(false)}
        onSubmit={async (review) => {
          const result = await submitCustomReview({ ...review, productId: product.id });
          trackStoreEvent("review_submitted", { outcome: result.ok ? "success" : "error" });
          if (result.ok) setMessage(result.message);
          return result;
        }}
      />

      {data.status === "available" && data.count > 0 && (
        <div className="mt-8">
          <PublicReviewFilters rating={publicReviews.view.rating} sort={publicReviews.view.sort} origin={publicReviews.view.origin} onChange={(patch) => { setShowAll(true); publicReviews.changeView(patch); }} />
        </div>
      )}

      <div id={resultsId} role="region" aria-label="Review results" aria-busy={publicReviews.pending || permalink.finding} className="scroll-mt-24">
        {data.status === "unavailable" ? (
          <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h3" className="text-xl">Reviews are taking a short break</Heading>
            <Text className="mt-2">We couldn&apos;t load reviews for this product. Please try again later.</Text>
          </div>
        ) : publicReviews.pending || permalink.finding ? (
          <ReviewCardSkeletons label={permalink.finding ? "Finding the linked review" : "Finding matching reviews"} columns="md:columns-2" className="mt-8" />
        ) : publicReviews.reviews.length ? (
          <ul id={`${formId}-reviews`} aria-label="Customer reviews" className="mt-8 gap-4 md:columns-2">
            {/* Masonry: cards keep their own height, filling each column top to bottom. */}
            {visibleReviews.map((review) => (
              <li key={review.id} className="mb-4 min-w-0 break-inside-avoid last:mb-0">
                <PublicReviewCard review={review} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h3" className="text-xl">{publicReviews.refined ? "No reviews match these filters" : "Be the first to report back"}</Heading>
            <Text className="mt-2">{publicReviews.refined ? "Try another star rating or source, or reset the filters to see every review." : "Own this one? Write the first review and tell the other Ryans how it holds up."}</Text>
          </div>
        )}
      </div>
      <div role="status" aria-live="polite" className="mt-6 text-sm text-black/70 empty:hidden dark:text-white/70">{permalink.message}</div>
      {publicReviews.error && <div className="mt-6 space-y-3">
        <ErrorCallout>{publicReviews.error}</ErrorCallout>
        <Button variant="secondary" className="w-full sm:w-auto" aria-controls={resultsId} onClick={publicReviews.retry}>Retry loading reviews</Button>
      </div>}
      {data.status === "available" && !expanded && publicReviews.total > 4 && <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Text className="text-sm">Showing {visibleReviews.length} of {publicReviews.total} reviews</Text>
        <Button variant="secondary" className="w-full sm:w-auto" aria-controls={resultsId} disabled={publicReviews.pending || !publicReviews.ready} onClick={() => {
          setShowAll(true);
          const url = new URL(window.location.href);
          url.searchParams.set(PRODUCT_REVIEW_PARAMS.page, "1");
          window.history.replaceState(null, "", url);
        }}>See all {publicReviews.total} reviews</Button>
      </div>}
      {data.status === "available" && expanded && <ReviewPagination resultsId={resultsId} page={publicReviews.page} pageSize={publicReviews.pageSize}
        total={publicReviews.total} pending={publicReviews.pending || !publicReviews.ready} onPageChange={(page) => { setShowAll(true); publicReviews.setPage(page); }} onPageSizeChange={(size) => { setShowAll(true); publicReviews.setPageSize(size); }} />}
    </section>
  );
}
