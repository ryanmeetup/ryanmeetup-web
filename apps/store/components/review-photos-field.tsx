"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ErrorCallout, FileDropField, IconButton, Text } from "@ryanmeetup/ui";
import { FiX } from "react-icons/fi";
import { prepareReviewPhoto, reviewPhotoKey, reviewPhotoLimits } from "@/lib/review-photos";
import type { ReviewPhoto } from "@/lib/review-photos";

function PhotoPreview({ photo, disabled, onRemove }: { photo: ReviewPhoto; disabled: boolean; onRemove: () => void }) {
  return (
    <li className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
      <Image src={photo.previewUrl} alt={`Review photo: ${photo.originalName}`} fill sizes="80px" unoptimized className="object-cover" />
      <IconButton label={`Remove ${photo.originalName}`} tooltip={false} variant="overlay" className="absolute right-1 top-1" disabled={disabled} onClick={onRemove}>
        <FiX aria-hidden className="size-4" />
      </IconButton>
    </li>
  );
}

export function ReviewPhotosField({ name, photos, onChange, pending, onPendingChange, disabled }: {
  name: string;
  photos: ReviewPhoto[];
  onChange: (photos: ReviewPhoto[]) => void;
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function selectFiles(files: File[]) {
    setError("");
    onPendingChange(true);
    const added: ReviewPhoto[] = [];
    try {
      const seen = new Set(photos.map((photo) => photo.sourceKey));
      for (const file of files) {
        if (photos.some((photo) => photo.file === file)) continue;
        const key = await reviewPhotoKey(file);
        if (seen.has(key)) continue;
        added.push(await prepareReviewPhoto(file, key));
        seen.add(key);
      }
      if (mounted.current) onChange([...photos, ...added]);
      else added.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    } catch (cause) {
      added.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Those photos couldn't be prepared. Please try again.");
    } finally {
      if (mounted.current) onPendingChange(false);
    }
  }

  return (
    <div className="space-y-3" aria-busy={pending}>
      <FileDropField
        label="Photos"
        name={name}
        multiple
        compact
        files={photos.map((photo) => photo.file)}
        onFilesChange={selectFiles}
        accept={reviewPhotoLimits.accept}
        maxFiles={reviewPhotoLimits.count}
        maxFileSize={reviewPhotoLimits.sourceBytes}
        disabled={disabled || pending}
        hint="Up to 5 photos · JPG, PNG, or WebP · 10 MB each"
        rejectMessage="Choose JPG, PNG, or WebP photos."
      />
      <div role="status" aria-label="Photo attachment status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">
        {pending ? "Preparing your photos…" : photos.length ? `${photos.length} of ${reviewPhotoLimits.count} photos added` : "Show other Ryans your merch in the wild."}
      </div>
      {photos.length > 0 && (
        <ul aria-label="Review photos" className="flex flex-wrap gap-3">
          {photos.map((photo) => <PhotoPreview key={photo.id} photo={photo} disabled={disabled || pending} onRemove={() => { setError(""); onChange(photos.filter((item) => item.id !== photo.id)); }} />)}
        </ul>
      )}
      {error && <ErrorCallout>{error}</ErrorCallout>}
      <Text className="text-xs">Photos will be public with your review. Avoid showing addresses, shipping labels, or other private details.</Text>
    </div>
  );
}
