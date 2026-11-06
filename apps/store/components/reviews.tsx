"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button, Card, ErrorCallout, FormStatus, Heading, Input, Kicker, Modal, ModalActions, RatingStars, StarRating, Text, Textarea } from "@ryanmeetup/ui";
import { FiCheck } from "react-icons/fi";
import type { Product, ReviewsData } from "@/lib/types";
import type { ReviewPhoto } from "@/lib/review-photos";
import type { ReviewAccount } from "@/lib/review-collection";
import { ReviewPhotosField } from "./review-photos-field";
import { ReviewPhotoGallery } from "./review-photo-gallery";

// Judge.me only accepts hosted picture URLs, and review photos have no host yet.
const reviewPhotosEnabled = false;
const emptyDraft ={ rating: null as number | null, body: "", name: "", email: "" };

function RatingSummary({ data, className = "" }: { data: ReviewsData; className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-sm text-black/65 dark:text-white/65 ${className}`}>
      <RatingStars rating={data.averageRating} />
      <span>{data.count ? `${data.averageRating.toFixed(1)} from ${data.count} review${data.count === 1 ? "" : "s"}` : "No reviews yet"}</span>
    </div>
  );
}

export function Reviews({ data, product, reviewAccount }: { data: ReviewsData; product: Pick<Product, "id" | "title" | "featuredImage">; reviewAccount: ReviewAccount | undefined }) {
  const formId = useId();
  const ratingField = useRef<HTMLDivElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const photoUrls = useRef(new Set<string>());
  const busy = loading || preparingPhotos;
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const current = new Set(photos.map((photo) => photo.previewUrl));
    photoUrls.current.forEach((url) => { if (!current.has(url)) URL.revokeObjectURL(url); });
    photoUrls.current = current;
  }, [photos]);
  useEffect(() => () => photoUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reviewAccount !== undefined) return;
    if (!draft.rating) {
      setError("Choose a rating before submitting your review.");
      ratingField.current?.querySelector("input")?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fields = { ...draft, productId: product.id, rating: Number(draft.rating) };
      let body: string | FormData = JSON.stringify(fields);
      if (photos.length) {
        const form = new FormData();
        Object.entries(fields).forEach(([key, value]) => form.set(key, String(value)));
        photos.forEach((photo) => form.append("photos", photo.file));
        body = form;
      }
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: photos.length ? undefined : { "Content-Type": "application/json" },
        body,
      });
      const payload = (await response.json()) as { error?: unknown; success?: unknown } | null;
      if (!response.ok || payload?.success !== true) {
        setError(typeof payload?.error === "string" ? payload.error : "Your review could not be submitted. Please try again.");
        return;
      }
      setSuccess(true);
      setDraft(emptyDraft);
      setPhotos([]);
      setShowForm(false);
    } catch {
      setError("Your review could not be submitted. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="reviews" className="border-t border-black/10 py-16 dark:border-white/10 sm:py-20">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Kicker>Customer dispatches</Kicker>
          <Heading size="h2" className="mt-2 text-3xl sm:text-4xl">The Ryans have spoken</Heading>
          <RatingSummary data={data} className="mt-3" />
        </div>
        {reviewAccount ? (
          reviewAccount.url ? (
            <Button.Link href={reviewAccount.url} prefetch={false} size="sm" variant="secondary" className="w-full sm:w-auto">Write a review</Button.Link>
          ) : (
            <Button size="sm" variant="secondary" className="w-full sm:w-auto" disabled>Write a review</Button>
          )
        ) : (
          <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => { setError(""); setShowForm(true); }}>Write a review</Button>
        )}
      </div>

      {reviewAccount && <Text className="mt-4 text-sm">{reviewAccount.url ? "Sign in to your customer account and choose a fulfilled order to review. You can add photos and manage your reviews there." : "Review collection is temporarily unavailable. Please try again later."}</Text>}

      <div role="status" aria-live="polite">
        {success && <FormStatus className="mt-6" title="Review received" icon={<FiCheck aria-hidden />}>Thanks for sharing your experience.</FormStatus>}
      </div>
      <Modal
        open={showForm && reviewAccount === undefined}
        setIsOpen={setShowForm}
        title="Write a review"
        size="lg"
        description="Tell other Ryans how it went."
        closable={!busy}
        formId={formId}
        onSubmit={submitReview}
        bodyClassName="space-y-5"
        panelClassName="max-sm:fixed max-sm:inset-0 max-sm:m-0 max-sm:h-dvh max-sm:!max-h-dvh max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[env(safe-area-inset-bottom)]"
        actions={<ModalActions onCancel={() => setShowForm(false)} confirmForm={formId} confirmLabel="Submit review" pending={busy} pendingLabel={preparingPhotos ? "Preparing photos" : "Submitting"} />}
      >
        <div className="flex items-center gap-4 rounded-xl border border-black/10 p-3 dark:border-white/10">
          {product.featuredImage && <Image src={product.featuredImage.url} alt="" width={64} height={64} sizes="64px" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
          <div className="min-w-0">
            <Text className="font-semibold">{product.title}</Text>
            <RatingSummary data={data} className="mt-1 flex-wrap gap-x-2 gap-y-1" />
          </div>
        </div>
        <fieldset disabled={busy} aria-busy={busy} className="min-w-0 space-y-5">
          <legend className="sr-only">Your review</legend>
          <div ref={ratingField} onInvalid={() => setError("Choose a rating before submitting your review.")}>
            <StarRating label="Rating" name={`${formId}-rating`} step={1} required disabled={busy} value={draft.rating} onChange={(rating) => setDraft((value) => ({ ...value, rating }))} />
          </div>
          <Textarea id={`${formId}-body`} label="Review" name="body" required maxLength={5000} placeholder="The good, the bad, the very Ryan. Tell us how it's holding up. We read every review." value={draft.body} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Display name" name={`${formId}-name`} required maxLength={100} autoComplete="name" placeholder="Ryan" value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} />
            <Input label="Email" name={`${formId}-email`} type="email" required maxLength={254} autoComplete="email" placeholder="Your email address" value={draft.email} onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))} />
          </div>
          <Text className="text-sm">Your display name and review will be public. Your email stays private. If your review flags a problem with your order, that&apos;s where we&apos;ll reach out to sort it.</Text>
          {reviewPhotosEnabled && <ReviewPhotosField name={`${formId}-photos`} photos={photos} onChange={setPhotos} pending={preparingPhotos} onPendingChange={setPreparingPhotos} disabled={loading} />}
        </fieldset>
        {error && <ErrorCallout>{error}</ErrorCallout>}
      </Modal>

      {data.reviews.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {data.reviews.map((review) => (
            <Card key={review.id} size="lg">
              <div className="flex items-center justify-between gap-3"><RatingStars rating={review.rating} /><time className="text-xs text-black/50 dark:text-white/50" dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</time></div>
              {review.title && <Heading size="h3" className="mt-4 text-xl">{review.title}</Heading>}
              <Text className="mt-2">{review.body}</Text>
              {!!review.photoUrls?.length && <ReviewPhotoGallery urls={review.photoUrls} reviewerName={review.reviewerName} />}
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em]">{review.reviewerName}{review.verified ? " · Verified buyer" : ""}</p>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20">
          <Heading size="h3" className="text-xl">Be the first to report back</Heading>
          <Text className="mt-2">This product is waiting for its first official Ryan review.</Text>
        </div>
      )}
    </section>
  );
}
