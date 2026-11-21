import { reviewModerationActions } from "./moderation";
import type { ModerationAction, ModerationReview } from "./moderation";

export const BULK_REVIEW_ACTIONS = ["approve", "republish", "reject", "hide", "restore", "delete"] as const;
export type BulkReviewAction = ModerationAction | "delete";

export const bulkReviewActionLabels: Record<BulkReviewAction, string> = {
  approve: "Publish waiting reviews",
  republish: "Publish rejected reviews",
  reject: "Reject reviews",
  hide: "Hide reviews",
  restore: "Restore reviews",
  delete: "Delete reviews",
};

/** Apply only to selected reviews that support the action, in queue order. */
export function bulkReviewTargets(reviews: ModerationReview[], action: BulkReviewAction): ModerationReview[] {
  return reviews.filter((review) => action === "delete" || reviewModerationActions(review).includes(action));
}
