"use client";

import type { ComponentType, ReactNode } from "react";

import { useId, useState } from "react";
import { FiCheckCircle, FiChevronDown, FiClock, FiEdit2, FiEye, FiEyeOff, FiMessageSquare, FiSlash, FiTrash2, FiXCircle } from "react-icons/fi";
import { AnimatedCollapse, Button, Card, Heading, IconButton, Kicker, RatingStars, Text } from "@ryanmeetup/ui";
import { ReviewAuthor, ReviewContent, ReviewReplyContent, ReviewVerificationBadge } from "@ryanmeetup/reviews/ui";
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
    <ReviewAuthor name={revision.displayName} detail={<>Submitted <time dateTime={revision.submittedAt}>{formatTimestamp(revision.submittedAt)}</time></>} />
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <RatingStars rating={revision.rating} />
        {verifiedPurchase !== undefined && <ReviewVerificationBadge kind={verifiedPurchase ? "purchase" : "unmatched"} />}
      </div>
      <ReviewContent title={revision.title} body={revision.body} bodyClassName="text-sm" />
    </div>
    {children}
  </section>;
}

type ModerationSelect = (review: ModerationReview, action: StaffReviewAction) => void;
export type ReviewModerationItemProps = {
  review: ModerationReview; disabled: boolean; staffNames: Record<string, string>;
  onSelect: ModerationSelect; onPhotoSelect: PhotoChoice;
};

/** Short enough for a chip; the notes beside a review's text explain what each state means. */
export function reviewStatus(review: ModerationReview): { label: string; Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; tone: string } {
  const quiet = "border-black/10 text-black/70 dark:border-white/10 dark:text-white/70";
  if (review.state === "hidden") return { label: "Hidden", Icon: FiEyeOff, tone: quiet };
  if (review.state === "withdrawn") return { label: "Withdrawn", Icon: FiSlash, tone: quiet };
  if (review.pending) return { label: review.published ? "Edit waiting" : "Waiting", Icon: FiClock, tone: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100" };
  if (review.rejected) return { label: review.published ? "Edit rejected" : "Rejected", Icon: FiXCircle, tone: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-100" };
  if (review.published) return { label: "Published", Icon: FiCheckCircle, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" };
  return { label: "Not published", Icon: FiMessageSquare, tone: quiet };
}

export function ReviewStatusChip({ review }: { review: ModerationReview }) {
  const { label, Icon, tone } = reviewStatus(review);
  return <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
    <Icon aria-hidden className="shrink-0" />{label}
  </span>;
}

/** The decisions a review is waiting on: publish, reject, or publish anyway. */
export function reviewDecisions(review: ModerationReview) {
  return reviewModerationActions(review).filter((action) => action !== "hide" && action !== "restore");
}

/**
 * Everything besides a decision: writing a reply, then visibility beside Delete,
 * since both take the whole review off the storefront.
 */
export function reviewSecondaryActions(review: ModerationReview) {
  const visibility = reviewModerationActions(review).filter((action) => action === "hide" || action === "restore");
  return [
    ...(!review.reply && reviewReplyActions(review).includes("reply-set") ? [{ action: "reply-set" as const, label: "Write reply", Icon: FiMessageSquare }] : []),
    ...visibility.map((action) => ({ action, label: moderationActionLabel(action, review), Icon: action === "hide" ? FiEyeOff : FiEye })),
    { action: "delete" as const, label: "Delete review", Icon: FiTrash2 },
  ];
}

/** A review's versions, photos, notes, reply, and history: what a card shows and a table row expands to. */
export function ReviewModerationDetails({ review, disabled, staffNames, onSelect, onPhotoSelect }: ReviewModerationItemProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();
  const second = Boolean(review.published && (review.pending || review.rejected));
  const version = (revision: ModerationRevision, label: string) => <ModerationVersion revision={revision} label={label} showLabel={second} verifiedPurchase={review.verifiedPurchase}>
    <ReviewModerationPhotos review={review} revision={revision} disabled={disabled} onSelect={onPhotoSelect} />
  </ModerationVersion>;
  const replyActions = reviewReplyActions(review);
  // recentEvents is newest first, so this is the reason for the rejection on screen.
  const rejectionNote = review.rejected ? review.recentEvents.find((event) => event.action === "rejected")?.note : null;
  return <div className="space-y-4">
      <div className="space-y-4 [&>section+section]:border-t [&>section+section]:border-black/10 [&>section+section]:pt-4 dark:[&>section+section]:border-white/10">
        {review.pending && version(review.pending, review.published ? "Waiting edit" : "Waiting for review")}
        {review.rejected && version(review.rejected, review.published ? "Rejected edit" : "Rejected version")}
        {review.published && version(review.published, review.state === "hidden" ? "Approved version · hidden" : "Published version")}
        {!review.pending && !review.published && !review.rejected && version(review.latest, "Last submitted version")}
      </div>
      {review.rejected && <div className="space-y-1">
        {rejectionNote && <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{review.state === "active" ? "Reason shown to the buyer" : "Rejection reason"}: {rejectionNote}</Text>}
        <Text className="text-sm">{review.published ? "This edit is kept, not deleted. The published version stays live until you publish the edit." :
          "Kept off the storefront, not deleted. You can still publish it."}</Text>
      </div>}
      {review.state === "hidden" && <Text className="text-sm">Hidden from the storefront and rating totals. Approving an edit keeps it hidden.</Text>}
      {review.state === "withdrawn" && <Text className="text-sm">Withdrawn by the buyer. Staff cannot restore this review.</Text>}
      {/* Only a saved reply earns a panel; writing one starts from the footer. */}
      {review.reply && <ReviewReplyContent official label="Reply from Ryan Meetup" heading="h3" body={review.reply.body}
        metadata={<Text className="text-xs">Updated <time dateTime={review.reply.updatedAt}>{formatTimestamp(review.reply.updatedAt)}</time></Text>}
        actions={replyActions.length > 0 && <div className="flex gap-2">
            {replyActions.map((action) => <IconButton key={action} size="md"
              label={`${moderationActionLabel(action, review)} for ${review.item.productTitle}`} disabled={disabled}
              variant={action === "reply-remove" ? "danger" : "subtle"} onClick={() => onSelect(review, action)}>
              {action === "reply-remove" ? <FiTrash2 aria-hidden /> : <FiEdit2 aria-hidden />}
            </IconButton>)}
        </div>}>
        {review.state !== "active" && <Text className="text-xs">This reply is not public while the review is {review.state}.</Text>}
      </ReviewReplyContent>}
      {/* A lone "Submitted" event repeats what the card already shows. */}
      {review.recentEvents.length > 1 && <div>
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
  </div>;
}

export function ReviewModerationCard(props: ReviewModerationItemProps) {
  const { review, disabled, onSelect } = props;
  const headingId = useId();
  return <article aria-labelledby={headingId} data-testid={`review-${review.id}`} className="@container/review min-w-0">
    <Card variant="outline" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Heading id={headingId} size="h2" className="text-base wrap-anywhere">{review.item.productTitle}</Heading>
          {review.item.variantTitle && <Text className="text-sm wrap-anywhere">{review.item.variantTitle}</Text>}
        </div>
        <ReviewStatusChip review={review} />
      </div>
      <ReviewModerationDetails {...props} />
      <div className="-mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-black/10 px-5 py-4 dark:border-white/10">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {reviewDecisions(review).map((action) =>
            <Button key={action} size="sm" className="w-full sm:w-auto" variant={action === "approve" ? "primary" : "secondary"} disabled={disabled} onClick={() => onSelect(review, action)}>
              {moderationActionLabel(action, review)}
            </Button>)}
        </div>
        {/* Secondary actions stay compact so the decisions keep one row. */}
        <div className="flex shrink-0 items-center gap-2">
          {reviewSecondaryActions(review).map(({ action, label, Icon }) =>
            <IconButton key={action} size="md" variant={action === "delete" ? "danger" : "subtle"} label={`${label} for ${review.item.productTitle}`}
              disabled={disabled} onClick={() => onSelect(review, action)}>
              <Icon aria-hidden />
            </IconButton>)}
        </div>
      </div>
    </Card>
  </article>;
}
