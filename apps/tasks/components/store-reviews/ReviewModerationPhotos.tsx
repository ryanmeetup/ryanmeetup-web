"use client";

import Image from "next/image";
import { useState } from "react";
import { FiAlertTriangle, FiCheck, FiCheckCircle, FiClock, FiMaximize2, FiRefreshCw, FiX, FiXCircle } from "react-icons/fi";
import { DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItems, DropdownMenuSeparator } from "@ryanmeetup/ui";
import type { StaffReviewPhoto } from "@ryanmeetup/reviews";
import { ReviewPhotoViewer } from "@ryanmeetup/reviews/ui";
import type { ModerationReview, ModerationRevision } from "@/lib/store-reviews/moderation";

export type PhotoChoice = (review: ModerationReview, revisionId: string, photo: StaffReviewPhoto, action: "photo-approve" | "photo-reject") => void;
export function staffPhotoUrl(review: ModerationReview, revisionId: string, photoId: string) {
  return `/api/admin/reviews/photos?${new URLSearchParams({ reviewId: review.id, revisionId, photoId, expectedUpdatedAt: review.updatedAt })}`;
}
/** Undecided photos on a version staff have not published yet go live when that version is published. */
function publishesWithReview(review: ModerationReview, revisionId: string) {
  return revisionId === review.pending?.id || revisionId === review.rejected?.id;
}

/** A thumbnail whose menu holds the photo's own decisions; the corner mark says where it stands. */
function PhotoThumb({ review, revisionId, photo, index, disabled, onSelect }: {
  review: ModerationReview; revisionId: string; photo: StaffReviewPhoto; index: number; disabled: boolean; onSelect: PhotoChoice;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const src = staffPhotoUrl(review, revisionId, photo.id);
  const withReview = publishesWithReview(review, revisionId);
  const status = photo.state === "pending" ? withReview ? "Publishes with review" : "Photo waiting" : photo.state === "approved" ? "Photo approved" : "Photo rejected";
  const Mark = photo.state === "approved" ? FiCheckCircle : photo.state === "rejected" ? FiXCircle : FiClock;
  const markTone = photo.state === "approved" ? "bg-emerald-600 text-white" : photo.state === "rejected" ? "bg-red-600 text-white" : "bg-white text-black ring-1 ring-black/20";
  const decided = review.state !== "withdrawn";
  const canApprove = decided && (photo.state === "rejected" || (photo.state === "pending" && !withReview));
  const canReject = decided && photo.state !== "rejected";
  return <li>
    <DropdownMenu>
      <DropdownMenuButton unstyled className="relative block size-12 overflow-hidden rounded-md border border-black/10 bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:border-white/10 dark:bg-white/5 dark:focus-visible:ring-white/50">
        {!failed && <Image key={attempt} src={src} alt="" fill sizes="48px" unoptimized className="object-cover"
          onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setFailed(true); }} />}
        {failed && <FiAlertTriangle aria-hidden className="absolute inset-0 m-auto text-black/60 dark:text-white/60" />}
        <span aria-hidden className={`absolute bottom-0.5 right-0.5 grid size-4 place-items-center rounded-full ${markTone}`}><Mark className="size-3" /></span>
        {/* The name carries the state and any reason, so the mark never speaks by colour alone. */}
        <span className="sr-only">Photo {index + 1}: {status}.{failed && " Photo could not load."}{photo.rejectionReason && ` Reason shown to the buyer: ${photo.rejectionReason}`}</span>
      </DropdownMenuButton>
      <DropdownMenuItems align="start">
        <p aria-hidden className="px-3 pb-1 pt-2 text-xs font-semibold text-black/70 dark:text-white/70">{status}</p>
        {photo.rejectionReason && <p aria-hidden className="whitespace-pre-wrap px-3 pb-2 text-xs text-black/70 wrap-anywhere dark:text-white/70">Reason shown to the buyer: {photo.rejectionReason}</p>}
        {failed ? <DropdownMenuItem disabled={disabled} onClick={() => { setFailed(false); setLoaded(false); setAttempt(attempt + 1); }}><FiRefreshCw aria-hidden /> Retry photo</DropdownMenuItem>
          : <DropdownMenuItem disabled={!loaded} onClick={() => setOpen(true)}><FiMaximize2 aria-hidden /> View photo</DropdownMenuItem>}
        {(canApprove || canReject) && <DropdownMenuSeparator />}
        {canApprove && <DropdownMenuItem disabled={disabled || !loaded} onClick={() => onSelect(review, revisionId, photo, "photo-approve")}><FiCheck aria-hidden /> Approve photo</DropdownMenuItem>}
        {canReject && <DropdownMenuItem disabled={disabled || !loaded} onClick={() => onSelect(review, revisionId, photo, "photo-reject")}><FiX aria-hidden /> Reject photo</DropdownMenuItem>}
      </DropdownMenuItems>
    </DropdownMenu>
    <ReviewPhotoViewer url={open ? src : null} onClose={() => setOpen(false)} title="Review photo" alt="Buyer-submitted product photo" />
  </li>;
}

export function ReviewModerationPhotos({ review, revision, disabled, onSelect }: {
  review: ModerationReview; revision: ModerationRevision; disabled: boolean; onSelect: PhotoChoice;
}) {
  if (!revision.photos?.length) return <span className="text-black/50 dark:text-white/50" aria-label="No photos">—</span>;
  return <ul aria-label="Review photos" className="flex flex-wrap gap-1.5">
    {revision.photos.map((photo, index) => <PhotoThumb key={photo.id} review={review} revisionId={revision.id} photo={photo} index={index} disabled={disabled} onSelect={onSelect} />)}
  </ul>;
}
