"use client";

import type { ReactNode } from "react";

import { useId, useState } from "react";
import { FiCheckCircle, FiChevronDown, FiClock, FiEdit2, FiEyeOff, FiMessageSquare, FiSlash, FiTrash2, FiUser, FiXCircle } from "react-icons/fi";
import { AnimatedCollapse, Avatar, Button, Card, Heading, IconButton, Kicker, RatingStars, Text } from "@ryanmeetup/ui";
import { formatTimestamp } from "@/lib/date-format";
import { moderationActionLabel, moderationReasonIsPublic, reviewModerationActions, reviewReplyActions } from "@/lib/store-reviews/moderation";
import type { ModerationReview, ModerationRevision, StaffReviewAction } from "@/lib/store-reviews/moderation";

import { ReviewModerationPhotos } from "./ReviewModerationPhotos";
import type { PhotoChoice } from "./ReviewModerationPhotos";

const eventLabels: Record<string, string> = {
  submitted: "Submitted", resubmitted: "Resubmitted", edited: "Edit submitted", withdrawn: "Withdrawn",
  photo_approved: "Photo approved", photo_rejected: "Photo rejected", approved: "Approved", rejected: "Rejected", hidden: "Hidden", restored: "Restored", reply_set: "Reply saved", reply_removed: "Reply removed",
};

export function ModerationVersion({ revision, label, showLabel = true, verifiedPurchase, children }: {
  revision: ModerationRevision; label: string; showLabel?: boolean; verifiedPurchase?: boolean; children?: ReactNode;
}) {
  return <section className="min-w-0 space-y-3" aria-label={label}>
    {showLabel && <Kicker className="text-xs tracking-caps-tight">{label}</Kicker>}
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden className="contents"><Avatar colorful name={revision.displayName} icon={revision.displayName === "Anonymous" ? <FiUser /> : undefined} /></span>
      <div className="min-w-0">
        <Text className="text-sm font-semibold wrap-anywhere">{revision.displayName}</Text>
        <Text className="text-xs">Submitted <time dateTime={revision.submittedAt}>{formatTimestamp(revision.submittedAt)}</time></Text>
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <RatingStars rating={revision.rating} />
        {verifiedPurchase !== undefined && (verifiedPurchase
          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200"><FiCheckCircle aria-hidden />Verified purchase</span>
          : <Text className="text-xs">No matching order</Text>)}
      </div>
      {revision.title && <Heading size="h3" variant="normal" className="text-base font-semibold wrap-anywhere">{revision.title}</Heading>}
      <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{revision.body}</Text>
    </div>
    {children}
  </section>;
}

export function ReviewModerationCard({ review, disabled, staffNames, onSelect, onPhotoSelect }: {
  review: ModerationReview; disabled: boolean; staffNames: Record<string, string>;
  onSelect: (review: ModerationReview, action: StaffReviewAction) => void;
  onPhotoSelect: PhotoChoice;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();
  const headingId = useId();
  const actions = reviewModerationActions(review);
  const second = Boolean(review.published && (review.pending || review.rejected));
  const version = (revision: ModerationRevision, label: string) => <ModerationVersion revision={revision} label={label} showLabel={second} verifiedPurchase={review.verifiedPurchase}>
    <ReviewModerationPhotos review={review} revision={revision} disabled={disabled} onSelect={onPhotoSelect} />
  </ModerationVersion>;
  const state = review.state === "hidden" ? "Hidden" : review.state === "withdrawn" ? "Withdrawn" :
    review.pending ? review.published ? "Edit waiting for approval" : "Waiting for approval" :
    review.rejected ? review.published ? "Edit rejected · published version stays live" : "Rejected" : review.published ? "Published" : "Not published";
  const StateIcon = review.state === "hidden" ? FiEyeOff : review.state === "withdrawn" ? FiSlash :
    review.pending ? FiClock : review.rejected ? FiXCircle : review.published ? FiCheckCircle : FiMessageSquare;
  const statusTone = review.state !== "active" ? "bg-black/5 text-black/70 dark:bg-white/5 dark:text-white/70" :
    review.pending ? "bg-sky-500/10 text-sky-900 dark:text-sky-100" :
    review.rejected ? "bg-red-500/10 text-red-800 dark:text-red-100" :
    review.published ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" : "bg-black/5 text-black/70 dark:bg-white/5 dark:text-white/70";
  // recentEvents is newest first, so this is the reason for the rejection on screen.
  const rejectionNote = review.rejected ? review.recentEvents.find((event) => event.action === "rejected")?.note : null;
  return <article aria-labelledby={headingId} data-testid={`review-${review.id}`} className="@container/review min-w-0">
    <Card variant="outline" className="space-y-4">
      <div className="border-b border-black/10 pb-4 dark:border-white/10">
        <div className="min-w-0 space-y-1">
          <Heading id={headingId} size="h2" className="text-base wrap-anywhere">{review.item.productTitle}</Heading>
          {review.item.variantTitle && <Text className="text-sm wrap-anywhere">{review.item.variantTitle}</Text>}
        </div>
      </div>
      <div className="space-y-4 [&>section+section]:border-t [&>section+section]:border-black/10 [&>section+section]:pt-4 dark:[&>section+section]:border-white/10">
        {review.pending && version(review.pending, review.published ? "Waiting edit" : "Waiting for review")}
        {review.rejected && version(review.rejected, review.published ? "Rejected edit" : "Rejected version")}
        {review.published && version(review.published, review.state === "hidden" ? "Approved version · hidden" : "Published version")}
        {!review.pending && !review.published && !review.rejected && version(review.latest, "Last submitted version")}
      </div>
      <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${statusTone}`}>
        <StateIcon aria-hidden className="mt-0.5 shrink-0" /><span>{state}</span>
      </p>
      {review.rejected && <div className="space-y-1">
        {rejectionNote && <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{review.state === "active" ? "Reason shown to the buyer" : "Rejection reason"}: {rejectionNote}</Text>}
        <Text className="text-sm">{review.published ? "This edit is kept, not deleted. The published version stays live until you publish the edit." :
          "Kept off the storefront, not deleted. You can still publish it."}</Text>
      </div>}
      {review.state === "hidden" && <Text className="text-sm">Hidden from the storefront and rating totals. Approving an edit keeps it hidden.</Text>}
      {review.state === "withdrawn" && <Text className="text-sm">Withdrawn by the buyer. Staff cannot restore this review.</Text>}
      {(review.reply || reviewReplyActions(review).length > 0) && <section aria-label="Official reply" className="space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading size="h3" variant="normal" className="text-sm font-semibold">Official reply</Heading>
          <div className="flex gap-2">
            {reviewReplyActions(review).map((action) => <IconButton key={action} size="md"
              label={`${moderationActionLabel(action, review)} for ${review.item.productTitle}`} disabled={disabled}
              variant={action === "reply-remove" ? "danger" : "subtle"} onClick={() => onSelect(review, action)}>
              {action === "reply-remove" ? <FiTrash2 aria-hidden /> : review.reply ? <FiEdit2 aria-hidden /> : <FiMessageSquare aria-hidden />}
            </IconButton>)}
          </div>
        </div>
        {review.reply ? <>
          <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{review.reply.body}</Text>
          <Text className="text-xs">Updated <time dateTime={review.reply.updatedAt}>{formatTimestamp(review.reply.updatedAt)}</time></Text>
        </> : null}
        {review.reply && review.state !== "active" && <Text className="text-xs">This reply is not public while the review is {review.state}.</Text>}
      </section>}
      {/* A lone "Submitted" event repeats what the card already shows. */}
      {review.recentEvents.length > 1 && <div className="border-t border-black/10 pt-3 dark:border-white/10">
        <Button variant="ghost" size="xs" aria-expanded={historyOpen} aria-controls={historyId}
          rightIcon={<FiChevronDown aria-hidden className={`transition-transform motion-reduce:transition-none ${historyOpen ? "rotate-180" : ""}`} />}
          onClick={() => setHistoryOpen(!historyOpen)}>
          Recent history ({review.recentEvents.length})
        </Button>
        <AnimatedCollapse id={historyId} open={historyOpen}>
          <ol className="mt-3 space-y-3 border-l border-black/10 pl-4 dark:border-white/10">
            {review.recentEvents.map((event, index) => <li key={`${event.createdAt}-${index}`} className="space-y-1 text-sm">
              <Text className="text-sm"><span className="font-semibold">{eventLabels[event.action] ?? event.action}</span> · {event.actorKind === "buyer" ? "Buyer" : staffNames[event.actor ?? ""] || "Staff member"}</Text>
              <Text className="text-xs"><time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time></Text>
              {event.note && <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{moderationReasonIsPublic(event.action) ? "Reason given to the buyer" : "Private reason"}: {event.note}</Text>}
            </li>)}
          </ol>
          <Text className="mt-3 text-xs">Up to 10 recent events. Review and photo rejection reasons are shown to the buyer until they resubmit; other reasons stay with staff.</Text>
        </AnimatedCollapse>
      </div>}
      <div className="-mx-5 -mb-5 flex items-end justify-between gap-3 border-t border-black/10 px-5 py-4 dark:border-white/10">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {actions.filter((action) => action !== "hide" && action !== "restore").map((action) =>
            <Button key={action} size="sm" className="w-full sm:w-auto" variant={action === "approve" ? "primary" : "secondary"} disabled={disabled} onClick={() => onSelect(review, action)}>
              {moderationActionLabel(action, review)}
            </Button>)}
        </div>
        {/* Visibility sits with Delete: both take the whole review off the storefront. */}
        <div className="flex shrink-0 items-center gap-2">
          {actions.filter((action) => action === "hide" || action === "restore").map((action) =>
            <Button key={action} size="sm" variant="secondary" aria-label={`${moderationActionLabel(action, review)} for ${review.item.productTitle}`}
              disabled={disabled} onClick={() => onSelect(review, action)}>
              {action === "hide" ? "Hide" : review.published ? "Restore" : "Unhide"}
            </Button>)}
          <Button size="sm" variant="danger" aria-label={`Delete review for ${review.item.productTitle}`}
            disabled={disabled} onClick={() => onSelect(review, "delete")}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  </article>;
}
