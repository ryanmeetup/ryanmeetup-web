"use client";

import Image from "next/image";
import { Button, ErrorCallout, FileDropField, IconButton, Spinner, Text } from "@ryanmeetup/ui";
import { FiTrash2 } from "react-icons/fi";
import { REVIEW_PHOTOS_MAX } from "@ryanmeetup/reviews";
import type { BuyerRejectedPhoto } from "@ryanmeetup/reviews";
import { REVIEW_PHOTO_ACCEPT, REVIEW_PHOTO_PICKER_MAX_BYTES } from "@/lib/review-photo-client";
import type { useReviewPhotos } from "./use-review-photos";

export function ReviewPhotoField({ photos, disabled, rejected = [] }: {
  photos: ReturnType<typeof useReviewPhotos>; disabled: boolean;
  /** Saved photos staff turned down, matched to the editor by ID. A photo the buyer removes takes its reason with it. */
  rejected?: BuyerRejectedPhoto[];
}) {
  const reasons = new Map(rejected.map((photo) => [photo.id, photo.reason]));
  const turnedDown = photos.items.flatMap((item, index) => {
    const reason = item.photo && !item.file ? reasons.get(item.photo.id) : undefined;
    return reason ? [{ item, index, reason }] : [];
  });
  const retained = photos.items.filter((item) => !item.file).length;
  const working = photos.phase === "loading" || photos.items.some((item) => item.status === "working" || item.status === "waiting");
  const failed = photos.items.flatMap((item, index) => item.status === "error" || item.error ? [{ item, index }] : []);
  return <div className="min-w-0 space-y-3" aria-busy={working}>
    <FileDropField label="Photos" name="review-photos" multiple compact files={photos.items.flatMap((item) => item.file ? [item.file] : [])}
      onFilesChange={photos.choose} accept={REVIEW_PHOTO_ACCEPT} maxFileSize={REVIEW_PHOTO_PICKER_MAX_BYTES}
      maxFiles={REVIEW_PHOTOS_MAX - retained} disabled={disabled || photos.phase !== "ready" || photos.items.length >= REVIEW_PHOTOS_MAX}
      hint="Up to five still JPEG, PNG, WebP or HEIC photos, 25 MiB each." rejectMessage="Choose a still JPEG, PNG, WebP or HEIC photo." />
    <div role="status" aria-live="polite" className="text-sm text-black/70 empty:hidden dark:text-white/70">
      {working ? <span className="inline-flex items-center gap-2"><Spinner size={16} />Preparing your photos…</span>
        : photos.items.length ? `${photos.items.length} of ${REVIEW_PHOTOS_MAX} photos selected.` : null}
    </div>
    {photos.error && <ErrorCallout>{photos.error}</ErrorCallout>}
    {photos.phase === "error" && <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={disabled} onClick={photos.reload}>Retry loading photos</Button>}
    {photos.items.length > 0 && <ul aria-label="Selected review photos" className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-4">
      {photos.items.map((item, index) => <li key={item.key} className="relative aspect-square min-w-0 overflow-hidden rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
        {/* A verified private blob stays in this browser; image optimization must never cache it. */}
        {item.url ? <Image unoptimized src={item.url} alt={`Review photo ${index + 1}`} fill sizes="(max-width: 639px) 33vw, 96px" className="object-cover" />
          : <div className="flex h-full items-center justify-center p-2 text-center text-xs text-black/70 dark:text-white/70">{item.status === "error" ? "Photo unavailable" : <Spinner size={16} label="Preparing photo" />}</div>}
        {turnedDown.some((entry) => entry.item.key === item.key) && <span className="absolute inset-x-0 bottom-0 bg-red-700/90 px-1 py-0.5 text-center text-xs font-semibold text-white">Not approved</span>}
        {/* IconButton renders inside a tooltip wrapper, so the wrapper owns the overlay position. */}
        <div className="absolute right-1 top-1">
          <IconButton type="button" size="sm" label={`Remove photo ${index + 1}`} disabled={disabled || item.status === "working"}
            className="bg-white/90 shadow-sm dark:bg-black/80" onClick={() => void photos.remove(item.key)}><FiTrash2 aria-hidden /></IconButton>
        </div>
      </li>)}
    </ul>}
    {turnedDown.length > 0 && <div className="space-y-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:border-red-400/35 dark:bg-red-950/45 dark:text-red-100">
      <dl className="space-y-2">
        {turnedDown.map(({ item, index, reason }) => <div key={item.key} className="space-y-0.5">
          <dt className="font-semibold">Photo {index + 1} wasn&apos;t approved</dt>
          <dd className="whitespace-pre-wrap wrap-anywhere">{reason}</dd>
        </div>)}
      </dl>
      <p className="opacity-80">Remove or replace {turnedDown.length === 1 ? "it" : "them"} before saving. If you keep {turnedDown.length === 1 ? "it" : "them"}, we&apos;ll take another look.</p>
    </div>}
    {failed.map(({ item, index }) => <div key={item.key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {item.error && <Text role="alert" className="min-w-0 text-sm text-red-600 dark:text-red-400">Photo {index + 1}: {item.error}</Text>}
      {item.status === "error" && <Button type="button" size="sm" variant="secondary" className="w-full shrink-0 sm:w-auto" disabled={disabled} onClick={() => photos.retry(item.key)}>Retry photo {index + 1}</Button>}
    </div>)}
  </div>;
}
