import { reviewReplyBodySchema } from "@ryanmeetup/reviews";
import type { ModerationDecision, ModerationQuery, ReviewReplyCommand } from "@/lib/store-reviews/moderation";
import { isModerationFilter, isModerationProductId, isModerationTimestamp } from "@/lib/store-reviews/moderation";
import { isUuid, objectWithKeys } from "./shared";

export function storeReviewReplySchema(value: unknown): ReviewReplyCommand | null {
  const input = objectWithKeys(value, ["reviewId", "expectedUpdatedAt", "body"]);
  if (!input || !isUuid(input.reviewId) || !isModerationTimestamp(input.expectedUpdatedAt)) return null;
  const body = input.body === null ? null : reviewReplyBodySchema(input.body);
  if (input.body !== null && body === null) return null;
  return { reviewId: input.reviewId, expectedUpdatedAt: input.expectedUpdatedAt, body };
}

export function storeReviewModerationSchema(value: unknown): ModerationDecision | null {
  const input = objectWithKeys(value, ["action", "reviewId", "expectedUpdatedAt", "revisionId", "note"]);
  if (!input || typeof input.action !== "string" || !["approve", "reject", "hide", "restore", "republish"].includes(input.action) ||
    !isUuid(input.reviewId) || !isModerationTimestamp(input.expectedUpdatedAt) ||
    (input.revisionId !== null && !isUuid(input.revisionId)) ||
    (input.note !== null && typeof input.note !== "string")) return null;
  const action = input.action as ModerationDecision["action"];
  if ((action === "approve" || action === "reject" || action === "republish") !== (input.revisionId !== null)) return null;
  const note = typeof input.note === "string" ? input.note.trim() || null : null;
  if ((note && ([...note].length > 1000 || /[\u0000-\u0008\u000b-\u001f\u007f]/u.test(note))) ||
    ((action === "hide" || action === "reject") && !note)) return null;
  return { action, reviewId: input.reviewId, expectedUpdatedAt: input.expectedUpdatedAt, revisionId: input.revisionId, note };
}

export function storeReviewModerationQuery(params: URLSearchParams): ModerationQuery | null {
  if ([...params.keys()].some((key) => !["filter", "productId", "afterCreatedAt", "afterId"].includes(key) || params.getAll(key).length !== 1)) return null;
  const filter = params.get("filter") ?? "pending";
  if (!isModerationFilter(filter)) return null;
  const productId = params.get("productId");
  if (productId !== null && !isModerationProductId(productId)) return null;
  const createdAt = params.get("afterCreatedAt");
  const id = params.get("afterId");
  if (createdAt === null && id === null) return { filter, productId, after: null };
  if (!isModerationTimestamp(createdAt) || !isUuid(id)) return null;
  return { filter, productId, after: { createdAt, id } };
}
