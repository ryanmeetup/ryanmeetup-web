"use client";

import { mutate, parseMutationResponse } from "@/lib/mutation-client";
import type { ModerationCursor, ModerationDecision, ModerationFilter, ModerationPage, ReviewDeletionCommand, ReviewReplyCommand } from "./moderation";

export async function fetchModerationPage(filter: ModerationFilter, productId: string | null, after: ModerationCursor | null = null): Promise<ModerationPage> {
  const params = new URLSearchParams({ filter });
  if (productId) params.set("productId", productId);
  if (after) {
    params.set("afterCreatedAt", after.createdAt);
    params.set("afterId", after.id);
  }
  return parseMutationResponse<ModerationPage>(await fetch(`/api/admin/reviews?${params}`, { cache: "no-store" }));
}

export async function saveModerationDecision(decision: ModerationDecision) {
  const result = await mutate<{ saved: boolean }>("/api/admin/reviews", { method: "POST", body: JSON.stringify(decision) });
  if (result.saved !== true) throw new Error("The decision could not be confirmed.");
}

export async function saveOfficialReply(command: ReviewReplyCommand) {
  const result = await mutate<{ saved: boolean }>("/api/admin/reviews", { method: "PATCH", body: JSON.stringify(command) });
  if (result.saved !== true) throw new Error("The reply could not be confirmed.");
}

/** Resolves with whether the review's photo files were removed too. */
export async function deleteStoreReview(command: ReviewDeletionCommand): Promise<{ photosRemoved: boolean }> {
  const result = await mutate<{ deleted: boolean; photosRemoved: boolean }>("/api/admin/reviews", { method: "DELETE", body: JSON.stringify(command) });
  if (result.deleted !== true) throw new Error("The deletion could not be confirmed.");
  return { photosRemoved: result.photosRemoved === true };
}
