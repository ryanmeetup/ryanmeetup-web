"use client";

import type { ComponentType, ReactNode } from "react";

import { FiCheckCircle, FiClock, FiEdit2, FiEye, FiEyeOff, FiMessageSquare, FiSlash, FiTrash2, FiXCircle } from "react-icons/fi";
import { Kicker, Modal, RatingStars, Text } from "@ryanmeetup/ui";
import { ReviewAuthor, ReviewContent, ReviewVerificationBadge } from "@ryanmeetup/reviews/ui";
import { formatTimestamp } from "@/lib/date-format";
import { moderationActionLabel, moderationReasonIsPublic, reviewModerationActions, reviewReplyActions } from "@/lib/store-reviews/moderation";
import type { ModerationReview, ModerationRevision, StaffReviewAction } from "@/lib/store-reviews/moderation";

const eventLabels: Record<string, string> = {
  submitted: "Submitted", resubmitted: "Resubmitted", edited: "Edit submitted", withdrawn: "Withdrawn",
  photo_approved: "Photo approved", photo_rejected: "Photo rejected", approved: "Approved", rejected: "Rejected", hidden: "Hidden", restored: "Restored", reply_set: "Reply saved", reply_removed: "Reply removed", imported: "Imported",
};

/** A full revision, as the decision dialogs show the text being decided on. */
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

type StatusIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
/** Short enough for a chip; `note` says what the state means for the storefront. */
export function reviewStatus(review: ModerationReview): { label: string; Icon: StatusIcon; tone: string; note?: string } {
  const quiet = "border-black/10 text-black/70 dark:border-white/10 dark:text-white/70";
  if (review.state === "hidden") return { label: "Hidden", Icon: FiEyeOff, tone: quiet, note: "Off the storefront and rating totals. Approving an edit keeps it hidden." };
  if (review.state === "withdrawn") return { label: "Withdrawn", Icon: FiSlash, tone: quiet, note: "Withdrawn by the buyer. Staff cannot restore this review." };
  if (review.pending) return { label: review.published ? "Edit waiting" : "Waiting", Icon: FiClock, tone: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    note: review.published ? "The published version stays live meanwhile." : undefined };
  if (review.rejected) return { label: review.published ? "Edit rejected" : "Rejected", Icon: FiXCircle, tone: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-100",
    note: review.published ? "Kept, not deleted. The published version stays live." : "Kept off the storefront, not deleted." };
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

type SecondaryAction = { action: Exclude<StaffReviewAction, "approve" | "reject" | "republish" | "photo-approve" | "photo-reject">; label: string; Icon: StatusIcon };
/**
 * Everything besides a decision, in menu order: the reply, then visibility,
 * then Delete on its own, since it is the one that cannot be undone.
 */
export function reviewSecondaryActions(review: ModerationReview): { everyday: SecondaryAction[]; destructive: SecondaryAction[] } {
  const visibility = reviewModerationActions(review).filter((action) => action === "hide" || action === "restore");
  return {
    everyday: [
      ...reviewReplyActions(review).map((action) => ({ action, label: moderationActionLabel(action, review),
        Icon: action === "reply-remove" ? FiTrash2 : review.reply ? FiEdit2 : FiMessageSquare })),
      ...visibility.map((action) => ({ action, label: moderationActionLabel(action, review), Icon: action === "hide" ? FiEyeOff : FiEye })),
    ],
    destructive: [{ action: "delete", label: "Delete review", Icon: FiTrash2 }],
  };
}

/** Up to 10 recent events, newest first; opened from the row menu. */
export function ReviewHistoryDialog({ review, staffNames, onClose }: { review: ModerationReview | null; staffNames: Record<string, string>; onClose: () => void }) {
  return <Modal open={Boolean(review)} setIsOpen={(open) => { if (!open) onClose(); }} dismissOnOutsideClick
    title="Recent history" description={review?.item.productTitle}>
    {review && <div className="space-y-4">
      <ol className="space-y-3 border-l border-black/10 pl-4 dark:border-white/10">
        {review.recentEvents.map((event, index) => <li key={`${event.createdAt}-${index}`} className="space-y-1 text-sm">
          <Text className="text-sm"><span className="font-semibold">{eventLabels[event.action] ?? event.action}</span> · {event.actorKind === "buyer" ? "Buyer" : staffNames[event.actor ?? ""] || "Staff member"}</Text>
          <Text className="text-xs"><time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time></Text>
          {event.note && <Text className="whitespace-pre-wrap text-sm wrap-anywhere">{moderationReasonIsPublic(event.action) ? "Reason given to the buyer" : "Private reason"}: {event.note}</Text>}
        </li>)}
      </ol>
      <Text className="text-xs">Up to 10 recent events. Review and photo rejection reasons are shown to the buyer until they resubmit; other reasons stay with staff.</Text>
    </div>}
  </Modal>;
}
