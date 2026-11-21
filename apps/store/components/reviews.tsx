"use client";

import { useId, useState } from "react";
import { Button, ErrorCallout, Heading, RatingStars, SuccessCallout, Text } from "@ryanmeetup/ui";
import type { Product, ReviewsData } from "@/lib/types";
import type { CustomReviewAccess } from "@/lib/custom-review-access";
import { CustomReviewComposer, type CustomReviewResult, type CustomReviewSubmission } from "./custom-review-composer";
import { PublicReviewCard } from "./public-review-card";
import { PublicReviewFilters } from "./public-review-filters";
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
  const publicReviews = usePublicReviews(data, product.id);
  const permalink = useReviewPermalink(data, product.id, publicReviews);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <section id="reviews" className="border-t border-black/10 py-16 dark:border-white/10 sm:py-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Heading size="h2" className="text-3xl sm:text-4xl">The Ryans have spoken</Heading>
          <RatingSummary data={data} className="mt-3" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-start lg:max-w-xs lg:items-end lg:text-right">
          <Button size="sm" variant="secondary" className="w-full sm:w-auto" disabled={access.status === "unavailable"} onClick={() => { setMessage(""); setOpen(true); }}>Write a review</Button>
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
          if (result.ok) setMessage(result.message);
          return result;
        }}
      />

      {data.status === "available" && data.count > 0 && (
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <PublicReviewFilters rating={publicReviews.rating} sort={publicReviews.sort} onChange={publicReviews.changeView} />
          <Text role="status" className="text-sm" aria-live="polite">
            {publicReviews.needsComplete ? (publicReviews.pending ? "Loading reviews…" : "Finish loading to see matching reviews.") :
              `Showing ${publicReviews.reviews.length} of ${data.count} review${data.count === 1 ? "" : "s"}`}
          </Text>
        </div>
      )}

      <div id={`${formId}-results`} role="region" aria-label="Review results" aria-busy={publicReviews.pending}>
        {data.status === "unavailable" ? (
          <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h3" className="text-xl">Reviews are taking a short break</Heading>
            <Text className="mt-2">We couldn&apos;t load reviews for this product. Please try again later.</Text>
          </div>
        ) : publicReviews.needsComplete ? (
          <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h3" className="text-xl">{publicReviews.pending ? "Finding matching reviews" : "More reviews to check"}</Heading>
            <Text className="mt-2">{publicReviews.pending ? "Checking every review for this product." : "Try loading again to see all reviews that match."}</Text>
          </div>
        ) : publicReviews.reviews.length ? (
          <ul id={`${formId}-reviews`} aria-label="Customer reviews" aria-busy={publicReviews.pending} className="mt-8 grid items-stretch gap-4 md:grid-cols-2">
            {publicReviews.reviews.map((review) => (
              <li key={review.id}>
                <PublicReviewCard review={review} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
            <Heading size="h3" className="text-xl">{publicReviews.refined ? "No reviews match this rating" : "Be the first to report back"}</Heading>
            <Text className="mt-2">{publicReviews.refined ? "Try another star rating or reset the filters to see every review." : "This product is waiting for its first official Ryan review."}</Text>
          </div>
        )}
      </div>
      {(publicReviews.cursor || publicReviews.pending || publicReviews.message || publicReviews.error || permalink.message) && <div className="mt-6 space-y-3">
        {publicReviews.cursor && <Button variant="secondary" className="w-full sm:w-auto" loading={publicReviews.pending} loadingText="Loading reviews…"
          aria-label={publicReviews.pending ? "Loading reviews…" : publicReviews.needsComplete ? "Retry loading reviews" : "Load more reviews"}
          aria-controls={`${formId}-results`} onClick={() => void publicReviews.loadMore()}>{publicReviews.needsComplete ? "Retry loading reviews" : "Load more reviews"}</Button>}
        <div role="status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">
          {publicReviews.pending ? permalink.finding ? "Loading your review…" : "Loading more reviews…" : permalink.message || publicReviews.message}
        </div>
        {publicReviews.error && <ErrorCallout>{publicReviews.error}</ErrorCallout>}
      </div>}
    </section>
  );
}
