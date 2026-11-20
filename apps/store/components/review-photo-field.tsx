"use client";

import Image from "next/image";
import { Button, ErrorCallout, FileDropField, IconButton, Spinner, Text } from "@ryanmeetup/ui";
import { FiTrash2 } from "react-icons/fi";
import { REVIEW_PHOTOS_MAX } from "@ryanmeetup/reviews";
import { REVIEW_PHOTO_PICKER_MAX_BYTES } from "@/lib/review-photo-client";
import type { useReviewPhotos } from "./use-review-photos";

export function ReviewPhotoField({ photos, disabled }: { photos: ReturnType<typeof useReviewPhotos>; disabled: boolean }) {
  const retained = photos.items.filter((item) => !item.file).length;
  const working = photos.phase === "loading" || photos.items.some((item) => item.status === "working" || item.status === "waiting");
  return <div className="min-w-0 space-y-3" aria-busy={working}>
    <FileDropField label="Photos" name="review-photos" multiple files={photos.items.flatMap((item) => item.file ? [item.file] : [])}
      onFilesChange={photos.choose} accept="image/jpeg,image/png,image/webp" maxFileSize={REVIEW_PHOTO_PICKER_MAX_BYTES}
      maxFiles={REVIEW_PHOTOS_MAX - retained} disabled={disabled || photos.phase !== "ready" || photos.items.length >= REVIEW_PHOTOS_MAX}
      hint="Up to five still JPEG, PNG or WebP photos, 4 MiB each." rejectMessage="Choose a still JPEG, PNG or WebP photo." />
    <Text className="text-sm">Photos are checked before they appear with your review.</Text>
    <div role="status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">
      {working ? <span className="inline-flex items-center gap-2"><Spinner size={16} />Preparing your photos…</span>
        : `${photos.items.length} of ${REVIEW_PHOTOS_MAX} photos selected.`}
    </div>
    {photos.error && <ErrorCallout>{photos.error}</ErrorCallout>}
    {photos.phase === "error" && <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={disabled} onClick={photos.reload}>Retry loading photos</Button>}
    {photos.items.length > 0 && <ul aria-label="Selected review photos" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {photos.items.map((item, index) => <li key={item.key} className="min-w-0 space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/10">
        <div className="relative aspect-[3/2] overflow-hidden rounded-lg bg-black/5 dark:bg-white/5">
          {/* A verified private blob stays in this browser; image optimization must never cache it. */}
          {item.url ? <Image unoptimized src={item.url} alt={`Review photo ${index + 1}`} fill sizes="(max-width: 639px) 100vw, 240px" className="object-contain" />
            : <div className="flex h-full items-center justify-center text-sm text-black/70 dark:text-white/70">{item.status === "error" ? "Photo unavailable" : "Preparing photo…"}</div>}
        </div>
        <div className="flex items-start justify-between gap-2">
          <Text className="min-w-0 text-sm wrap-anywhere">{item.file?.name ?? `Saved photo ${index + 1}`}</Text>
          <IconButton type="button" size="sm" label={`Remove photo ${index + 1}`} disabled={disabled || item.status === "working"}
            onClick={() => void photos.remove(item.key)}><FiTrash2 aria-hidden /></IconButton>
        </div>
        {item.error && <Text role="alert" className="text-sm text-red-600 dark:text-red-400">{item.error}</Text>}
        {item.status === "error" && <Button type="button" size="sm" variant="secondary" className="w-full sm:w-auto" disabled={disabled} onClick={() => photos.retry(item.key)}>Retry photo {index + 1}</Button>}
      </li>)}
    </ul>}
  </div>;
}
