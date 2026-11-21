"use client";

import { useState } from "react";
import { FiClock, FiMoreHorizontal } from "react-icons/fi";
import { Button, DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItems, DropdownMenuSeparator, RatingStars } from "@ryanmeetup/ui";
import { ReviewVerificationBadge } from "@ryanmeetup/reviews/ui";
import { formatTimestamp } from "@/lib/date-format";
import { moderationActionLabel } from "@/lib/store-reviews/moderation";
import type { ModerationReview, ModerationRevision, StaffReviewAction } from "@/lib/store-reviews/moderation";

import { ReviewModerationPhotos } from "./ReviewModerationPhotos";
import type { PhotoChoice } from "./ReviewModerationPhotos";
import { ReviewHistoryDialog, ReviewStatusChip, reviewDecisions, reviewSecondaryActions, reviewStatus } from "./ReviewModerationParts";

type TableProps = {
  reviews: ModerationReview[]; disabled: boolean; staffNames: Record<string, string>;
  onSelect: (review: ModerationReview, action: StaffReviewAction) => void; onPhotoSelect: PhotoChoice;
};
type RowProps = Omit<TableProps, "reviews" | "staffNames"> & { review: ModerationReview; onHistory: (review: ModerationReview) => void };

/** The status column already says edit or new review, so a row's buttons can drop that word. */
function shortDecision(action: StaffReviewAction, review: ModerationReview) {
  if (action === "approve") return review.state === "hidden" ? "Approve" : "Publish";
  if (action === "reject") return "Reject";
  return moderationActionLabel(action, review);
}

/** The version a decision acts on comes first; the live one follows when an edit is waiting or was rejected. */
function reviewVersions(review: ModerationReview): { revision: ModerationRevision; label: string }[] {
  const decided = review.pending
    ? { revision: review.pending, label: review.published ? "Waiting edit" : "Waiting for review" }
    : review.rejected ? { revision: review.rejected, label: review.published ? "Rejected edit" : "Rejected version" } : null;
  const live = review.published ? { revision: review.published, label: review.state === "hidden" ? "Approved version · hidden" : "Published version" } : null;
  const versions = [decided, live].filter((version) => version !== null);
  return versions.length ? versions : [{ revision: review.latest, label: "Last submitted version" }];
}

function ReviewCell({ review }: { review: ModerationReview }) {
  const versions = reviewVersions(review);
  const labelled = versions.length > 1;
  return <div className="space-y-3">
    {versions.map(({ revision, label }, index) => <section key={revision.id} aria-label={label}
      className={`min-w-0 space-y-1 ${index > 0 ? "border-t border-black/10 pt-3 dark:border-white/10" : ""}`}>
      {labelled && <p className="text-[10px] font-semibold uppercase tracking-caps-tight text-black/60 dark:text-white/60">{label}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <RatingStars rating={revision.rating} />
        {index === 0 && <ReviewVerificationBadge kind={review.verifiedPurchase ? "purchase" : "unmatched"} />}
      </div>
      {revision.title && <p className="font-semibold wrap-anywhere">{revision.title}</p>}
      <p className="whitespace-pre-wrap text-black/70 wrap-anywhere dark:text-white/70">{revision.body}</p>
    </section>)}
    {review.reply && <section aria-label="Reply from Ryan Meetup" className="space-y-1 border-l-2 border-black/15 pl-3 text-xs dark:border-white/20">
      <p className="font-semibold">Reply from Ryan Meetup <span className="font-normal text-black/60 dark:text-white/60">· <time dateTime={review.reply.updatedAt}>{formatTimestamp(review.reply.updatedAt)}</time></span></p>
      <p className="whitespace-pre-wrap text-black/70 wrap-anywhere dark:text-white/70">{review.reply.body}</p>
      {review.state !== "active" && <p className="text-black/60 dark:text-white/60">Not public while the review is {review.state}.</p>}
    </section>}
  </div>;
}

function StatusCell({ review }: { review: ModerationReview }) {
  const { note } = reviewStatus(review);
  // recentEvents is newest first, so this is the reason for the rejection on screen.
  const rejectionNote = review.rejected ? review.recentEvents.find((event) => event.action === "rejected")?.note : null;
  return <div className="space-y-1.5">
    <ReviewStatusChip review={review} />
    {note && <p className="text-xs text-black/70 dark:text-white/70">{note}</p>}
    {rejectionNote && <p className="whitespace-pre-wrap text-xs text-black/70 wrap-anywhere dark:text-white/70">
      {review.state === "active" ? "Reason shown to the buyer" : "Rejection reason"}: {rejectionNote}
    </p>}
  </div>;
}

function RowActions({ review, disabled, onSelect, onHistory }: Omit<RowProps, "onPhotoSelect">) {
  const { everyday, destructive } = reviewSecondaryActions(review);
  // A lone "Submitted" event repeats what the row already shows.
  const history = review.recentEvents.length > 1;
  return <div className="flex flex-wrap items-center gap-2 @min-[54rem]:flex-nowrap @min-[54rem]:justify-end">
    {reviewDecisions(review).map((action) => <Button key={action} size="xs" variant={action === "approve" ? "primary" : "secondary"}
      aria-label={`${moderationActionLabel(action, review)} for ${review.item.productTitle}`} disabled={disabled} onClick={() => onSelect(review, action)}>
      {shortDecision(action, review)}
    </Button>)}
    {/* Dense rows keep one trigger for everything that is not a decision. */}
    <DropdownMenu>
      <DropdownMenuButton unstyled disabled={disabled} aria-label={`More actions for ${review.item.productTitle}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-black transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-50 data-open:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10 dark:focus-visible:ring-white/30 dark:data-open:bg-white/10">
        <FiMoreHorizontal aria-hidden />
      </DropdownMenuButton>
      <DropdownMenuItems align="end">
        {everyday.map(({ action, label, Icon }) => <DropdownMenuItem key={action} destructive={action === "reply-remove"} onClick={() => onSelect(review, action)}>
          <Icon aria-hidden /> {label}
        </DropdownMenuItem>)}
        {history && <DropdownMenuItem onClick={() => onHistory(review)}><FiClock aria-hidden /> Recent history ({review.recentEvents.length})</DropdownMenuItem>}
        {(everyday.length > 0 || history) && <DropdownMenuSeparator />}
        {destructive.map(({ action, label, Icon }) => <DropdownMenuItem key={action} destructive onClick={() => onSelect(review, action)}>
          <Icon aria-hidden /> {label}
        </DropdownMenuItem>)}
      </DropdownMenuItems>
    </DropdownMenu>
  </div>;
}

// Below the breakpoint each row restacks as a single column; above it, the cells line up under the headers.
const cell = "min-w-0 @min-[54rem]:px-3 @min-[54rem]:py-3 @min-[54rem]:align-middle";

function ReviewRow({ review, disabled, onSelect, onPhotoSelect, onHistory }: RowProps) {
  const photoRevision = review.pending ?? review.rejected ?? review.published ?? review.latest;
  return <tr data-testid={`review-${review.id}`}
    className="grid gap-3 border-t border-black/10 p-4 text-sm first:border-t-0 dark:border-white/10 @min-[54rem]:table-row @min-[54rem]:p-0 @min-[54rem]:first:border-t">
    <td className={`${cell} @min-[54rem]:pl-4`}>
      <p className="font-semibold wrap-anywhere">{review.item.productTitle}</p>
      {review.item.variantTitle && <p className="text-xs text-black/70 wrap-anywhere dark:text-white/70">{review.item.variantTitle}</p>}
    </td>
    <td className={cell}><ReviewCell review={review} /></td>
    {/* A dash keeps the column readable on wide screens; a stacked row simply skips it. */}
    <td className={`${cell} @min-[54rem]:px-2 ${photoRevision.photos?.length ? "" : "hidden @min-[54rem]:table-cell"}`}><ReviewModerationPhotos review={review} revision={photoRevision} disabled={disabled} onSelect={onPhotoSelect} /></td>
    <td className={cell}>
      <p className="font-semibold wrap-anywhere">{photoRevision.displayName}</p>
      <p className="text-xs text-black/70 dark:text-white/70"><time dateTime={photoRevision.submittedAt}>{formatTimestamp(photoRevision.submittedAt)}</time></p>
    </td>
    <td className={cell}><StatusCell review={review} /></td>
    <td className={`${cell} @min-[54rem]:pl-2 @min-[54rem]:pr-4`}><RowActions review={review} disabled={disabled} onSelect={onSelect} onHistory={onHistory} /></td>
  </tr>;
}

/** The moderation queue: one row per review, every detail in its own column. */
export function ReviewModerationTable({ reviews, staffNames, ...props }: TableProps) {
  const [history, setHistory] = useState<ModerationReview | null>(null);
  return <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
    <table className="block w-full text-left @min-[54rem]:table @min-[54rem]:table-fixed">
      <caption className="sr-only">Store reviews</caption>
      <colgroup><col className="w-32" /><col /><col className="w-28" /><col className="w-36" /><col className="w-36" /><col className="w-52" /></colgroup>
      {/* Stacked rows read top to bottom, so the header row is only for screen readers there. */}
      <thead className="sr-only bg-black/[0.025] text-[10px] uppercase tracking-caps-tight text-black/60 dark:bg-white/[0.025] dark:text-white/60 @min-[54rem]:not-sr-only @min-[54rem]:table-header-group">
        <tr>
          <th className="py-3 pl-4 pr-3 font-semibold">Product</th>
          <th className="px-3 py-3 font-semibold">Review</th>
          <th className="px-2 py-3 font-semibold">Photos</th>
          <th className="px-3 py-3 font-semibold">Reviewer</th>
          <th className="px-3 py-3 font-semibold">Status</th>
          <th className="py-3 pl-3 pr-4"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="block @min-[54rem]:table-row-group">
        {reviews.map((review) => <ReviewRow key={`${review.id}-${review.updatedAt}`} review={review} onHistory={setHistory} {...props} />)}
      </tbody>
    </table>
    <ReviewHistoryDialog review={history} staffNames={staffNames} onClose={() => setHistory(null)} />
  </div>;
}
