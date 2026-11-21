"use client";

import Image from "next/image";
import { useState } from "react";
import { Button, Modal, Pill, Text } from "@ryanmeetup/ui";
import type { StaffReviewPhoto } from "@ryanmeetup/reviews";
import type { ModerationReview, ModerationRevision } from "@/lib/store-reviews/moderation";

export type PhotoChoice = (review: ModerationReview, revisionId: string, photo: StaffReviewPhoto, action: "photo-approve" | "photo-reject") => void;
export function staffPhotoUrl(review: ModerationReview, revisionId: string, photoId: string) {
  return `/api/admin/reviews/photos?${new URLSearchParams({ reviewId: review.id, revisionId, photoId, expectedUpdatedAt: review.updatedAt })}`;
}
function Photo({ review, revisionId, photo, disabled, onSelect }: {
  review: ModerationReview; revisionId: string; photo: StaffReviewPhoto; disabled: boolean; onSelect: PhotoChoice;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const src = staffPhotoUrl(review, revisionId, photo.id);
  return <li className="min-w-0 space-y-2 rounded-lg border border-black/10 p-2 dark:border-white/10">
    <button type="button" disabled={!loaded || disabled} aria-label="Enlarge review photo"
      onClick={() => setOpen(true)} className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:bg-white/5 dark:focus-visible:outline-white">
      {!failed && <Image key={attempt} src={src} alt="Buyer-submitted product photo" fill sizes="(max-width: 639px) 40vw, 200px" unoptimized
        className="object-contain" onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setFailed(true); }} />}
    </button>
    {failed && <div role="alert" className="space-y-2"><Text className="text-xs">Photo could not load.</Text>
      <Button size="xs" variant="secondary" disabled={disabled} onClick={() => { setFailed(false); setLoaded(false); setAttempt(attempt + 1); }}>Retry photo</Button></div>}
    <Pill size="sm" variant={photo.state === "approved" ? "success" : "neutral"}>{photo.state === "pending" ? "Photo waiting" : photo.state === "approved" ? "Photo approved" : "Photo rejected"}</Pill>
    {review.state !== "withdrawn" && <div className="flex flex-col gap-2">
      {photo.state !== "approved" && <Button size="xs" variant="secondary" disabled={disabled || !loaded} onClick={() => onSelect(review, revisionId, photo, "photo-approve")}>Approve photo</Button>}
      {photo.state !== "rejected" && <Button size="xs" variant="secondary" disabled={disabled || !loaded} onClick={() => onSelect(review, revisionId, photo, "photo-reject")}>Reject photo</Button>}
    </div>}
    <Modal open={open} setIsOpen={setOpen} title="Review photo" size="lg">
      <div className="relative aspect-[4/3]"><Image src={src} alt="Buyer-submitted product photo" fill sizes="(max-width: 639px) 90vw, 624px" unoptimized className="object-contain" /></div>
    </Modal>
  </li>;
}
export function ReviewModerationPhotos({ review, revision, disabled, onSelect }: {
  review: ModerationReview; revision: ModerationRevision; disabled: boolean; onSelect: PhotoChoice;
}) {
  if (!revision.photos?.length) return null;
  return <div className="space-y-2">
    <Text className="text-xs">Photos need their own approval. Only approved photos on the public text version appear in the store.</Text>
    <ul aria-label="Review photos" className="grid grid-cols-2 gap-2 @lg/review:grid-cols-3">
      {revision.photos.map((photo) => <Photo key={photo.id} review={review} revisionId={revision.id} photo={photo} disabled={disabled} onSelect={onSelect} />)}
    </ul>
  </div>;
}
