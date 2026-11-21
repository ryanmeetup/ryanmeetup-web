"use client";

import { useState } from "react";
import { FiChevronDown, FiImage, FiMoreHorizontal } from "react-icons/fi";
import {
  AnimatedCollapse, Button, DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItems, DropdownMenuSeparator, IconButton, RatingStars,
} from "@ryanmeetup/ui";
import { formatTimestamp } from "@/lib/date-format";
import { moderationActionLabel } from "@/lib/store-reviews/moderation";
import type { ModerationReview, StaffReviewAction } from "@/lib/store-reviews/moderation";

import type { PhotoChoice } from "./ReviewModerationPhotos";
import { ReviewModerationDetails, ReviewStatusChip, reviewDecisions, reviewSecondaryActions } from "./ReviewModerationCard";

type TableProps = {
  reviews: ModerationReview[]; disabled: boolean; staffNames: Record<string, string>;
  onSelect: (review: ModerationReview, action: StaffReviewAction) => void; onPhotoSelect: PhotoChoice;
};

/** The status column already says edit or new review, so a row's buttons can drop that word. */
function shortDecision(action: StaffReviewAction, review: ModerationReview) {
  if (action === "approve") return review.state === "hidden" ? "Approve" : "Publish";
  if (action === "reject") return "Reject";
  return moderationActionLabel(action, review);
}

function RowActions({ review, disabled, onSelect }: Pick<TableProps, "disabled" | "onSelect"> & { review: ModerationReview }) {
  const secondary = reviewSecondaryActions(review);
  const destructive = secondary.filter(({ action }) => action === "delete");
  const rest = secondary.filter(({ action }) => action !== "delete");
  return <div className="flex items-center justify-end gap-2">
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
        {rest.map(({ action, label, Icon }) => <DropdownMenuItem key={action} onClick={() => onSelect(review, action)}>
          <Icon aria-hidden /> {label}
        </DropdownMenuItem>)}
        {rest.length > 0 && <DropdownMenuSeparator />}
        {destructive.map(({ action, label, Icon }) => <DropdownMenuItem key={action} destructive onClick={() => onSelect(review, action)}>
          <Icon aria-hidden /> {label}
        </DropdownMenuItem>)}
      </DropdownMenuItems>
    </DropdownMenu>
  </div>;
}

function Row({ review, disabled, staffNames, onSelect, onPhotoSelect }: Omit<TableProps, "reviews"> & { review: ModerationReview }) {
  const [open, setOpen] = useState(false);
  // Details mount on first open, so a long queue does not fetch every photo up front.
  const [opened, setOpened] = useState(false);
  const detailsId = `review-details-${review.id}`;
  // The version a decision would act on, else the one shoppers see.
  const shown = review.pending ?? review.rejected ?? review.published ?? review.latest;
  const photos = shown.photos?.length ?? 0;
  return <>
    <tr data-testid={`review-row-${review.id}`} className={`border-t border-black/10 align-top transition hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.025] ${open ? "bg-black/[0.025] dark:bg-white/[0.025]" : ""}`}>
      <td className="py-3 pl-3">
        <IconButton size="sm" variant="subtle" label={`${open ? "Hide" : "Show"} details for ${review.item.productTitle}`}
          aria-expanded={open} aria-controls={detailsId} onClick={() => { setOpen(!open); setOpened(true); }}>
          <FiChevronDown aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
        </IconButton>
      </td>
      <td className="min-w-0 px-3 py-3">
        <p className="truncate font-semibold">{review.item.productTitle}{review.item.variantTitle && <span className="font-normal text-black/70 dark:text-white/70"> · {review.item.variantTitle}</span>}</p>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-black/70 dark:text-white/70">
          <RatingStars rating={shown.rating} className="shrink-0" />
          {photos > 0 && <span className="inline-flex shrink-0 items-center gap-1"><FiImage aria-hidden />{photos}<span className="sr-only"> {photos === 1 ? "photo" : "photos"}</span></span>}
          <span className="truncate">{shown.title || shown.body}</span>
        </div>
      </td>
      <td className="min-w-0 px-3 py-3">
        <p className="truncate font-semibold">{shown.displayName}</p>
        <p className="mt-1 truncate text-xs text-black/70 dark:text-white/70"><time dateTime={shown.submittedAt}>{formatTimestamp(shown.submittedAt)}</time></p>
      </td>
      <td className="px-3 py-3"><ReviewStatusChip review={review} /></td>
      <td className="py-3 pl-3 pr-4"><RowActions review={review} disabled={disabled} onSelect={onSelect} /></td>
    </tr>
    <tr className={open ? "bg-black/[0.025] dark:bg-white/[0.025]" : ""}>
      <td colSpan={5} className="p-0">
        <AnimatedCollapse id={detailsId} open={open}>
          {opened && <div className="@container/review px-4 pb-5 pl-14 pt-1">
            <ReviewModerationDetails review={review} disabled={disabled} staffNames={staffNames} onSelect={onSelect} onPhotoSelect={onPhotoSelect} />
          </div>}
        </AnimatedCollapse>
      </td>
    </tr>
  </>;
}

/** The queue as one row per review; a row expands to the same details a card shows. */
export function ReviewModerationTable({ reviews, ...props }: TableProps) {
  return <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
    <table className="w-full table-fixed text-left text-sm">
      <caption className="sr-only">Store reviews</caption>
      <colgroup><col className="w-14" /><col /><col className="w-40" /><col className="w-36" /><col className="w-56" /></colgroup>
      <thead className="bg-black/[0.025] text-[10px] uppercase tracking-caps-tight text-black/60 dark:bg-white/[0.025] dark:text-white/60">
        <tr>
          <th className="py-3 pl-3"><span className="sr-only">Details</span></th>
          <th className="px-3 py-3 font-semibold">Review</th>
          <th className="px-3 py-3 font-semibold">Reviewer</th>
          <th className="px-3 py-3 font-semibold">Status</th>
          <th className="py-3 pl-3 pr-4"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {reviews.map((review) => <Row key={`${review.id}-${review.updatedAt}`} review={review} {...props} />)}
      </tbody>
    </table>
  </div>;
}
