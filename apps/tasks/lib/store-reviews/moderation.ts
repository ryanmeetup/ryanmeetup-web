import type { PublicReviewItem, ReviewRating } from "@ryanmeetup/reviews";

export const MODERATION_FILTERS = ["pending", "published", "hidden", "rejected", "all"] as const;
export type ModerationFilter = (typeof MODERATION_FILTERS)[number];
/** `republish` publishes a rejected revision after all; rejected text is never deleted. */
export type ModerationAction = "approve" | "reject" | "hide" | "restore" | "republish";
export type ReplyAction = "reply-set" | "reply-remove";
export type StaffReviewAction = ModerationAction | ReplyAction;
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
  }
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
