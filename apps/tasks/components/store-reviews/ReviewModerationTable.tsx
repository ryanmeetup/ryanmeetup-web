"use client";

import { useState } from "react";
import { FiClock } from "react-icons/fi";
import { Button, DropdownMenu, DropdownMenuItem, DropdownMenuItems, DropdownMenuSeparator, RatingStars } from "@ryanmeetup/ui";
import { ReviewVerificationBadge } from "@ryanmeetup/reviews/ui";
import { ResponsiveTable, ResponsiveTableCell, ResponsiveTableMenuButton, ResponsiveTableRow } from "@/components/global";
import { formatTimestamp } from "@/lib/date-format";
import { moderationActionLabel, moderationVerification } from "@/lib/store-reviews/moderation";
import type { ModerationReview, ModerationRevision, StaffReviewAction } from "@/lib/store-reviews/moderation";

import { ReviewModerationPhotos } from "./ReviewModerationPhotos";
import { ReviewSelectionCheckbox } from "./ReviewSelectionCheckbox";
import type { PhotoChoice } from "./ReviewModerationPhotos";
import { ReviewHistoryDialog, ReviewStatusChip, reviewDecisions, reviewSecondaryActions, reviewStatus } from "./ReviewModerationParts";

type TableProps = {
  reviews: ModerationReview[]; disabled: boolean; staffNames: Record<string, string>;
  selectedIds: ReadonlySet<string>; onToggleReview: (id: string) => void;
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
  // A table cell ignores max-width, so the cap lives here; long text wraps instead of widening the column.
  return <div className="space-y-3 @min-[54rem]:max-w-md">
    {versions.map(({ revision, label }, index) => <section key={revision.id} aria-label={label}
      className={`min-w-0 space-y-1 ${index > 0 ? "border-t border-black/10 pt-3 dark:border-white/10" : ""}`}>
      {labelled && <p className="text-[10px] font-semibold uppercase tracking-caps-tight text-black/60 dark:text-white/60">{label}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <RatingStars rating={revision.rating} />
        {index === 0 && <ReviewVerificationBadge kind={moderationVerification(review)} />}
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

function RowActions({ review, disabled, onSelect, onHistory }: Pick<RowProps, "review" | "disabled" | "onSelect" | "onHistory">) {
  const { everyday, destructive } = reviewSecondaryActions(review);
  // A lone "Submitted" event repeats what the row already shows.
  const history = review.recentEvents.length > 1;
  return <div className="flex flex-wrap items-center gap-2 @min-[54rem]:flex-nowrap @min-[54rem]:justify-end @min-[54rem]:gap-1.5">
    {reviewDecisions(review).map((action) => <Button key={action} size="xs" variant={action === "approve" ? "primary" : "secondary"}
      aria-label={`${moderationActionLabel(action, review)} for ${review.item.productTitle}`} disabled={disabled} onClick={() => onSelect(review, action)}>
      {shortDecision(action, review)}
    </Button>)}
    {/* Dense rows keep one trigger for everything that is not a decision. */}
    <DropdownMenu>
      <ResponsiveTableMenuButton disabled={disabled} label={`More actions for ${review.item.productTitle}`} />
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

function ReviewRow({ review, disabled, selectedIds, onToggleReview, onSelect, onPhotoSelect, onHistory }: RowProps) {
  const photoRevision = review.pending ?? review.rejected ?? review.published ?? review.latest;
  return <ResponsiveTableRow data-testid={`review-${review.id}`}>
    {/* Selection stays at the start of the row, whichever column comes first. */}
    <ResponsiveTableCell>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-5 items-center">
          <ReviewSelectionCheckbox label={`Select review for ${review.item.productTitle}`} checked={selectedIds.has(review.id)}
            disabled={disabled} onChange={() => onToggleReview(review.id)} />
        </span>
        <div className="min-w-0 flex-1"><ReviewCell review={review} /></div>
      </div>
    </ResponsiveTableCell>
    <ResponsiveTableCell className="@min-[54rem]:whitespace-nowrap">
      <p className="font-semibold wrap-anywhere">{review.item.productTitle}</p>
      {review.item.variantTitle && <p className="text-xs text-black/70 wrap-anywhere dark:text-white/70">{review.item.variantTitle}</p>}
    </ResponsiveTableCell>
    {/* A dash keeps the column readable on wide screens; a stacked row simply skips it. */}
    <ResponsiveTableCell className={photoRevision.photos?.length ? "" : "hidden @min-[54rem]:table-cell"}>
      <ReviewModerationPhotos review={review} revision={photoRevision} disabled={disabled} onSelect={onPhotoSelect} />
    </ResponsiveTableCell>
    <ResponsiveTableCell>
      <p className="font-semibold wrap-anywhere">{photoRevision.displayName}</p>
      <p className="text-xs text-black/70 @min-[54rem]:whitespace-nowrap dark:text-white/70"><time dateTime={photoRevision.submittedAt}>{formatTimestamp(photoRevision.submittedAt)}</time></p>
    </ResponsiveTableCell>
    <ResponsiveTableCell><StatusCell review={review} /></ResponsiveTableCell>
    <ResponsiveTableCell><RowActions review={review} disabled={disabled} onSelect={onSelect} onHistory={onHistory} /></ResponsiveTableCell>
  </ResponsiveTableRow>;
}

const columns = [
  // Auto layout sizes columns to content: the review text is capped in its cell, the reviewer date stays on one line.
  { label: "Review" }, { label: "Product" }, { label: "Photos", width: "w-20" },
  { label: "Reviewer" }, { label: "Status" }, { label: "Actions", hideLabel: true },
];

/** The moderation queue: one row per review, every detail in its own column. */
export function ReviewModerationTable({ reviews, staffNames, ...props }: TableProps) {
  const [history, setHistory] = useState<ModerationReview | null>(null);
  return <>
    <ResponsiveTable caption="Store reviews" columns={columns} layout="auto" className="relative overflow-x-auto">
      {reviews.map((review) => <ReviewRow key={`${review.id}-${review.updatedAt}`} review={review} onHistory={setHistory} {...props} />)}
    </ResponsiveTable>
    <ReviewHistoryDialog review={history} staffNames={staffNames} onClose={() => setHistory(null)} />
  </>;
}
