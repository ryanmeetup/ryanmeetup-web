"use client";

import type { ReactNode } from "react";

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
  // Short enough for a header chip; the notes below the text explain what each state means.
  const state = review.state === "hidden" ? "Hidden" : review.state === "withdrawn" ? "Withdrawn" :
    review.pending ? review.published ? "Edit waiting" : "Waiting" :
    review.rejected ? review.published ? "Edit rejected" : "Rejected" : review.published ? "Published" : "Not published";
  const StateIcon = review.state === "hidden" ? FiEyeOff : review.state === "withdrawn" ? FiSlash :
    review.pending ? FiClock : review.rejected ? FiXCircle : review.published ? FiCheckCircle : FiMessageSquare;
  const statusTone = review.state !== "active" ? "border-black/10 text-black/70 dark:border-white/10 dark:text-white/70" :
    review.pending ? "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100" :
    review.rejected ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-100" :
    review.published ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100" : "border-black/10 text-black/70 dark:border-white/10 dark:text-white/70";
  const replyActions = reviewReplyActions(review);
  // recentEvents is newest first, so this is the reason for the rejection on screen.
  const rejectionNote = review.rejected ? review.recentEvents.find((event) => event.action === "rejected")?.note : null;
  return <article aria-labelledby={headingId} data-testid={`review-${review.id}`} className="@container/review min-w-0">
    <Card variant="outline" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Heading id={headingId} size="h2" className="text-base wrap-anywhere">{review.item.productTitle}</Heading>
          {review.item.variantTitle && <Text className="text-sm wrap-anywhere">{review.item.variantTitle}</Text>}
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone}`}>
          <StateIcon aria-hidden className="shrink-0" />{state}
        </span>
      </div>
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
      <div className="-mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-black/10 px-5 py-4 dark:border-white/10">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {actions.filter((action) => action !== "hide" && action !== "restore").map((action) =>
            <Button key={action} size="sm" className="w-full sm:w-auto" variant={action === "approve" ? "primary" : "secondary"} disabled={disabled} onClick={() => onSelect(review, action)}>
              {moderationActionLabel(action, review)}
            </Button>)}
        </div>
        {/* Secondary actions stay compact so the decisions keep one row. Visibility sits with Delete: both take the whole review off the storefront. */}
        <div className="flex shrink-0 items-center gap-2">
          {!review.reply && replyActions.includes("reply-set") && <IconButton size="md" label={`Write reply for ${review.item.productTitle}`}
            disabled={disabled} onClick={() => onSelect(review, "reply-set")}>
            <FiMessageSquare aria-hidden />
          </IconButton>}
          {actions.filter((action) => action === "hide" || action === "restore").map((action) =>
            <IconButton key={action} size="md" label={`${moderationActionLabel(action, review)} for ${review.item.productTitle}`}
              disabled={disabled} onClick={() => onSelect(review, action)}>
              {action === "hide" ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
            </IconButton>)}
          <IconButton size="md" variant="danger" label={`Delete review for ${review.item.productTitle}`}
            disabled={disabled} onClick={() => onSelect(review, "delete")}>
            <FiTrash2 aria-hidden />
          </IconButton>
        </div>
      </div>
    </Card>
  </article>;
}
