"use client";

import { ApiMutationError } from "@/lib/mutation-client";
import { moderationReasonRequired, moderationRevisionId } from "./moderation";
import type { ModerationReview, ReviewDeletionReason } from "./moderation";
import { bulkReviewTargets } from "./bulk-moderation";
import type { BulkReviewAction } from "./bulk-moderation";
import { deleteStoreReview, saveModerationDecision } from "./moderation-client";

/** Every review retains its own authorization, stale-view check, and audit entry. */
export async function saveBulkReviewActions({ action, reviews, note, reason, onProgress }: {
  action: BulkReviewAction; reviews: ModerationReview[]; note: string | null;
  reason?: ReviewDeletionReason; onProgress?: (completed: number) => void;
}) {
  const targets = bulkReviewTargets(reviews, action);
  if ((action === "delete" && !reason) || (action !== "delete" && moderationReasonRequired(action) && !note?.trim())) {
    throw new Error("A reason is required for this action.");
  }
  let saved = 0, conflicts = 0, uncertain = 0, photosLeft = 0;
  for (const review of targets) {
    try {
      if (action === "delete") {
        const outcome = await deleteStoreReview({ reviewId: review.id, expectedUpdatedAt: review.updatedAt, reason: reason!, note });
        if (!outcome.photosRemoved) photosLeft++;
      } else {
        await saveModerationDecision({ action, reviewId: review.id, expectedUpdatedAt: review.updatedAt,
          revisionId: moderationRevisionId(action, review), note });
      }
      saved++;
    } catch (error) {
      if (error instanceof ApiMutationError && error.code === "CONFLICT") conflicts++;
      else uncertain++;
    }
    onProgress?.(saved + conflicts + uncertain);
    // A lost response may follow a committed write. Stop without retrying it.
    if (uncertain) break;
  }
  return { saved, conflicts, uncertain, photosLeft, unattempted: targets.length - saved - conflicts - uncertain };
}
