"use client";

import { useId, useState } from "react";
import { FiChevronDown, FiEdit2, FiEye, FiEyeOff, FiMessageSquare, FiTrash2 } from "react-icons/fi";
import { AnimatedCollapse, Button, Card, Heading, IconButton, Kicker, Pill, RatingStars, Text } from "@ryanmeetup/ui";
import { formatTimestamp } from "@/lib/date-format";
import { moderationActionLabel, reviewModerationActions, reviewReplyActions } from "@/lib/store-reviews/moderation";
import type { ModerationReview, ModerationRevision, StaffReviewAction } from "@/lib/store-reviews/moderation";

const eventLabels: Record<string, string> = {
  submitted: "Submitted", resubmitted: "Resubmitted", edited: "Edit submitted", withdrawn: "Withdrawn",
  approved: "Approved", rejected: "Rejected", hidden: "Hidden", restored: "Restored", reply_set: "Reply saved", reply_removed: "Reply removed",
};

export function ModerationVersion({ revision, label }: { revision: ModerationRevision; label: string }) {
  return <section className="min-w-0 space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10" aria-label={label}>
    <Kicker>{label}</Kicker>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <RatingStars rating={revision.rating} />
      <Text className="text-sm font-semibold wrap-anywhere">{revision.displayName}</Text>
    </div>
    {revision.title && <Heading size="h3" variant="normal" className="text-base font-semibold wrap-anywhere">{revision.title}</Heading>}
    <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{revision.body}</Text>
    <Text className="text-xs">Submitted <time dateTime={revision.submittedAt}>{formatTimestamp(revision.submittedAt)}</time></Text>
  </section>;
}

export function ReviewModerationCard({ review, disabled, staffNames, onSelect }: {
  review: ModerationReview; disabled: boolean; staffNames: Record<string, string>;
  onSelect: (review: ModerationReview, action: StaffReviewAction) => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();
  const headingId = useId();
  const actions = reviewModerationActions(review);
  const state = review.state === "hidden" ? "Hidden" : review.state === "withdrawn" ? "Withdrawn" : review.published ? "Published" :
    review.pending ? "Pending" : review.rejected ? "Rejected" : "Not published";
  const second = review.published && (review.pending || review.rejected);
  // recentEvents is newest first, so this is the reason for the rejection on screen.
  const rejectionNote = review.rejected ? review.recentEvents.find((event) => event.action === "rejected")?.note : null;
  return <article aria-labelledby={headingId} data-testid={`review-${review.id}`}>
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Heading id={headingId} size="h2" variant="normal" className="text-lg font-semibold wrap-anywhere">{review.item.productTitle}</Heading>
          {review.item.variantTitle && <Text className="text-sm wrap-anywhere">{review.item.variantTitle}</Text>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Pill size="sm" variant="neutral">{state}</Pill>
          {review.pending && review.published && <Pill size="sm" variant="neutral">Edit waiting</Pill>}
          {review.rejected && review.published && <Pill size="sm" variant="neutral">Edit rejected</Pill>}
          {!review.verifiedPurchase && <Pill size="sm" variant="neutral">No matching order</Pill>}
        </div>
      </div>
      <div className={`grid items-start gap-4 ${second ? "xl:grid-cols-2" : ""}`}>
        {review.pending && <ModerationVersion revision={review.pending} label={review.published ? "Waiting edit" : "Waiting for review"} />}
        {review.rejected && <ModerationVersion revision={review.rejected} label={review.published ? "Rejected edit" : "Rejected version"} />}
        {review.published && <ModerationVersion revision={review.published} label={review.state === "hidden" ? "Approved version · hidden" : "Published version"} />}
        {!review.pending && !review.published && !review.rejected && <ModerationVersion revision={review.latest} label="Last submitted version" />}
      </div>
      {review.rejected && <div className="space-y-1">
        {rejectionNote && <Text className="whitespace-pre-wrap text-sm wrap-anywhere">Private reason: {rejectionNote}</Text>}
        <Text className="text-sm">{review.published ? "This edit is kept, not deleted. The published version stays live until you publish the edit." :
          "Kept off the storefront, not deleted. You can still publish it."}</Text>
      </div>}
      {review.state === "hidden" && <Text className="text-sm">Hidden from the storefront and rating totals. Approving an edit keeps it hidden.</Text>}
      {review.state === "withdrawn" && <Text className="text-sm">Withdrawn by the buyer. Staff cannot restore this review.</Text>}
      {actions.length > 0 && <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => action === "hide" || action === "restore" ?
          <IconButton key={action} size="md" label={`${moderationActionLabel(action, review)} for ${review.item.productTitle}`} disabled={disabled} onClick={() => onSelect(review, action)}>
            {action === "hide" ? <FiEyeOff aria-hidden /> : <FiEye aria-hidden />}
          </IconButton> :
          <Button key={action} variant={action === "approve" ? "primary" : "secondary"} disabled={disabled} onClick={() => onSelect(review, action)}>
            {moderationActionLabel(action, review)}
          </Button>)}
      </div>}
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
        </> : <Text className="text-sm">No official reply yet.</Text>}
        {review.state !== "active" && <Text className="text-xs">This reply is not public while the review is {review.state}.</Text>}
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
              {event.note && <Text className="whitespace-pre-wrap text-sm wrap-anywhere">Private reason: {event.note}</Text>}
            </li>)}
          </ol>
          <Text className="mt-3 text-xs">Up to 10 recent events. Reasons are visible only to staff.</Text>
        </AnimatedCollapse>
      </div>}
    </Card>
  </article>;
}
