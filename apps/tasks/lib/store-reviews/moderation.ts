import type { StaffReviewPhoto } from "@ryanmeetup/reviews";
import type { PublicReviewItem, ReviewRating } from "@ryanmeetup/reviews";

export const MODERATION_FILTERS = ["pending", "published", "hidden", "rejected", "all"] as const;
export type ModerationFilter = (typeof MODERATION_FILTERS)[number];
/** `republish` publishes a rejected revision after all; rejected text is never deleted. */
export type ModerationAction = "approve" | "reject" | "hide" | "restore" | "republish";
export type ReplyAction = "reply-set" | "reply-remove";
export type StaffReviewAction = ModerationAction | ReplyAction | "delete" | "photo-approve" | "photo-reject";

/**
 * The only grounds for deleting a review. They follow the FTC consumer review
 * rule (16 CFR 465.7), which permits removing reviews for these reasons when
 * the policy applies to every review alike, and forbids removing one for its
 * rating or a negative opinion. Keep in step with `store_delete_review`.
 */
export const REVIEW_DELETION_REASONS = ["spam", "false_or_misleading", "unrelated", "confidential", "abusive", "discriminatory"] as const;
export type ReviewDeletionReason = (typeof REVIEW_DELETION_REASONS)[number];
export const reviewDeletionReasonLabels: Record<ReviewDeletionReason, string> = {
  spam: "Spam or fake review",
  false_or_misleading: "Clearly false or misleading",
  unrelated: "Unrelated to the product",
  confidential: "Trade secrets or private information",
  abusive: "Defamatory, harassing, abusive, obscene, or sexually explicit",
  discriminatory: "Demeans a protected or intrinsic characteristic",
};
export function isReviewDeletionReason(value: unknown): value is ReviewDeletionReason {
  return REVIEW_DELETION_REASONS.includes(value as ReviewDeletionReason);
}
export type ReviewDeletionCommand = {
  reviewId: string;
  expectedUpdatedAt: string;
  reason: ReviewDeletionReason;
  note: string | null;
};
export type ModerationCursor = { createdAt: string; id: string };
export type ModerationQuery = { filter: ModerationFilter; productId: string | null; after: ModerationCursor | null };
export type ModerationProduct = { productId: string; productTitle: string };
export type ModerationDecision = {
  action: ModerationAction;
  reviewId: string;
  expectedUpdatedAt: string;
  revisionId: string | null;
  note: string | null;
};
export type ReviewReplyCommand = { reviewId: string; expectedUpdatedAt: string; body: string | null };
export type ModerationReply = { body: string; publishedAt: string; updatedAt: string };
export type ModerationRevision = {
  id: string; rating: ReviewRating; title: string | null; body: string;
  displayName: string; submittedAt: string;
  photos?: StaffReviewPhoto[];
};
export type ModerationEvent = {
  action: string; actorKind: "buyer" | "staff"; actor: string | null;
  note: string | null; createdAt: string;
};
export type ModerationReview = {
  id: string; state: "active" | "hidden" | "withdrawn";
  createdAt: string; updatedAt: string; item: PublicReviewItem;
  /** False when the buyer had no matching order; the review still needs the same approval. */
  verifiedPurchase: boolean;
  pending: ModerationRevision | null; published: ModerationRevision | null;
  latest: ModerationRevision;
  /** The latest revision when staff rejected it and the buyer has not written since. */
  rejected: ModerationRevision | null;
  recentEvents: ModerationEvent[];
  reply: ModerationReply | null;
};
export type ModerationPage = { reviews: ModerationReview[]; next: ModerationCursor | null; products: ModerationProduct[] };
export type ModerationInitialState =
  | { status: "ready"; page: ModerationPage }
  | { status: "disabled" }
  | { status: "error" };

export function reviewModerationActions(review: ModerationReview): ModerationAction[] {
  if (review.state === "withdrawn") return [];
  return [
    ...(review.pending ? ["approve", "reject"] as const : []),
    ...(review.rejected ? ["republish"] as const : []),
    ...(review.state === "hidden" ? ["restore"] as const : review.published ? ["hide"] as const : []),
  ];
}

export function moderationReasonRequired(action: ModerationAction) {
  return action === "reject" || action === "hide";
}

/** Publishing needs no confirmation and carries no note; every other decision opens a dialog. */
export type PublishAction = Extract<ModerationAction, "approve" | "republish">;
export function isPublishAction(action: StaffReviewAction): action is PublishAction {
  return action === "approve" || action === "republish";
}

/** A rejection reason is written for the buyer, who reads it on My reviews; other notes stay with staff. */
export function moderationReasonIsPublic(action: ModerationAction | string) {
  return action === "reject" || action === "rejected" || action === "photo-reject" || action === "photo_rejected";
}

export function reviewReplyActions(review: ModerationReview): ReplyAction[] {
  if (review.state === "withdrawn" || !review.published) return [];
  return review.reply ? ["reply-set", "reply-remove"] : ["reply-set"];
}

export function moderationActionLabel(action: StaffReviewAction, review: ModerationReview) {
  switch (action) {
    case "approve": return review.state === "hidden" ? "Approve revision" : review.published ? "Publish edit" : "Publish review";
    case "reject": return review.published ? "Reject edit" : "Reject review";
    case "hide": return "Hide review";
    case "restore": return review.published ? "Restore review" : "Unhide review";
    case "republish": return "Publish anyway";
    case "reply-set": return review.reply ? "Edit reply" : "Write reply";
    case "reply-remove": return "Remove reply";
    case "delete": return "Delete review";
    case "photo-approve": return "Approve photo";
    case "photo-reject": return "Reject photo";
  }
}

/** Cards are the default layout; `?view=table` asks for one row per review. */
export type ModerationView = "cards" | "table";
export function moderationView(value: unknown): ModerationView {
  return value === "table" ? "table" : "cards";
}

/** Shopify numeric product IDs, as stored on each review. */
export function isModerationProductId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value);
}

/** The revision a decision applies to: waiting text, rejected text, or none. */
export function moderationRevisionId(action: ModerationAction, review: ModerationReview): string | null {
  if (action === "approve" || action === "reject") return review.pending?.id ?? null;
  return action === "republish" ? review.rejected?.id ?? null : null;
}

export function isModerationFilter(value: unknown): value is ModerationFilter {
  return MODERATION_FILTERS.includes(value as ModerationFilter);
}

/** Keep PostgreSQL's exact timestamp for stale-view checks; do not round-trip through Date. */
export function isModerationTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === `${value.slice(0, 23)}Z`;
}

export type ReviewPhotoDecision = {
  reviewId: string; revisionId: string; photoId: string; expectedUpdatedAt: string;
  action: "approve" | "reject"; note: string | null;
};
