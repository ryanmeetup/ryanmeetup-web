import type { PublicReviewItem, ReviewRating } from "@ryanmeetup/reviews";

export const MODERATION_FILTERS = ["pending", "published", "hidden", "all"] as const;
export type ModerationFilter = (typeof MODERATION_FILTERS)[number];
export type ModerationAction = "approve" | "reject" | "hide" | "restore";
export type ModerationCursor = { createdAt: string; id: string };
export type ModerationQuery = { filter: ModerationFilter; after: ModerationCursor | null };
export type ModerationDecision = {
  action: ModerationAction;
  reviewId: string;
  expectedUpdatedAt: string;
  revisionId: string | null;
  note: string | null;
};
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
  pending: ModerationRevision | null; published: ModerationRevision | null;
  latest: ModerationRevision; recentEvents: ModerationEvent[];
};
export type ModerationPage = { reviews: ModerationReview[]; next: ModerationCursor | null };
export type ModerationInitialState =
  | { status: "ready"; page: ModerationPage }
  | { status: "disabled" }
  | { status: "error" };

export function reviewModerationActions(review: ModerationReview): ModerationAction[] {
  if (review.state === "withdrawn") return [];
  return [
    ...(review.pending ? ["approve", "reject"] as const : []),
    ...(review.state === "hidden" ? ["restore"] as const : review.published ? ["hide"] as const : []),
  ];
}

export function moderationReasonRequired(action: ModerationAction) {
  return action === "reject" || action === "hide";
}

export function moderationActionLabel(action: ModerationAction, review: ModerationReview) {
  switch (action) {
    case "approve": return review.state === "hidden" ? "Approve revision" : review.published ? "Publish edit" : "Publish review";
    case "reject": return review.published ? "Reject edit" : "Reject review";
    case "hide": return "Hide review";
    case "restore": return review.published ? "Restore review" : "Unhide review";
  }
}

export function isModerationFilter(value: unknown): value is ModerationFilter {
  return MODERATION_FILTERS.includes(value as ModerationFilter);
}

/** Keep PostgreSQL's exact timestamp for stale-view checks; do not round-trip through Date. */
export function isModerationTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === `${value.slice(0, 23)}Z`;
}
