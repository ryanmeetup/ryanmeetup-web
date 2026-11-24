import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { REVIEW_SOURCES, importedReviewContentSchema, reviewReplyBodySchema, reviewSubmissionSchema, staffReviewPhotoSchema } from "@ryanmeetup/reviews";
import type { ReviewSource, StaffReviewPhoto } from "@ryanmeetup/reviews";
import { parseUuid } from "@/lib/api-schema";
import { isModerationProductId, isModerationTimestamp } from "@/lib/store-reviews/moderation";
import { StoreReviewDatabaseError } from "./errors";
import type { ModerationDecision, ReviewDeletionCommand, ModerationEvent, ModerationPage, ModerationProduct, ModerationQuery, ModerationReview, ModerationRevision, ReviewReplyCommand } from "@/lib/store-reviews/moderation";

function object(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === keys.length && keys.every((key) => key in row) ? row : null;
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && [...value].length <= max && value === value.trim();
}
/** Only an imported review may lack a title; Etsy reviews never had one. */
function revisionContent(row: Record<string, unknown>, source: ReviewSource): Pick<ModerationRevision, "rating" | "title" | "body"> | null {
  if (row.title !== null) return reviewSubmissionSchema({ rating: row.rating, title: row.title, body: row.body, nameStyle: "anonymous" });
  if (source === "store") return null;
  const imported = importedReviewContentSchema({ rating: row.rating, body: row.body, displayName: row.displayName });
  return imported && { rating: imported.rating, title: null, body: imported.body };
}
function revision(value: unknown, source: ReviewSource): ModerationRevision | null {
  const fields = ["id", "rating", "title", "body", "displayName", "submittedAt"];
  const row = object(value, [...fields, "photos"]) ?? object(value, fields);
  if (!row || !parseUuid(row.id) || !isModerationTimestamp(row.submittedAt) || !text(row.displayName, 60)) return null;
  const content = revisionContent(row, source);
  if (!content || content.title !== row.title || content.body !== row.body) return null;
  const rows = row.photos ?? [];
  if (!Array.isArray(rows) || rows.length > 5) return null;
  const photos = rows.map(staffReviewPhotoSchema);
  if (photos.some((photo) => !photo) || new Set(photos.map((photo) => photo!.id)).size !== photos.length) return null;
  return { photos: photos as StaffReviewPhoto[], id: row.id as string, rating: content.rating, title: content.title, body: content.body, displayName: row.displayName, submittedAt: row.submittedAt };
}
const eventActions = ["submitted", "resubmitted", "edited", "withdrawn", "approved", "rejected", "hidden", "restored", "reply_set", "reply_removed", "photo_approved", "photo_rejected", "imported"];
function event(value: unknown): ModerationEvent | null {
  const row = object(value, ["action", "actorKind", "actor", "note", "createdAt"]);
  if (!row || !eventActions.includes(String(row.action)) || !isModerationTimestamp(row.createdAt) ||
    !["buyer", "staff"].includes(String(row.actorKind)) ||
    (row.actorKind === "buyer" ? row.actor !== null : !text(row.actor, 200)) ||
    (row.note !== null && !text(row.note, 1000))) return null;
  return row as ModerationEvent;
}
function review(value: unknown): ModerationReview | null {
  const fields = ["id", "state", "createdAt", "updatedAt", "item", "verifiedPurchase", "pending", "published", "latest", "rejected", "recentEvents", "reply"];
  // A backend from before 20261121150000 sends no source; every review it holds was written on the store.
  const row = object(value, [...fields, "source"]) ?? object(value, fields);
  const source = (row?.source ?? "store") as ReviewSource;
  if (!row || !parseUuid(row.id) || !["active", "hidden", "withdrawn"].includes(String(row.state)) || !REVIEW_SOURCES.includes(source) ||
    !isModerationTimestamp(row.createdAt) || !isModerationTimestamp(row.updatedAt) || typeof row.verifiedPurchase !== "boolean") return null;
  const item = object(row.item, ["productId", "productTitle", "variantTitle"]);
  if (!item || !isModerationProductId(item.productId) ||
    !text(item.productTitle, 255) || (item.variantTitle !== null && !text(item.variantTitle, 255))) return null;
  const pending = row.pending === null ? null : revision(row.pending, source);
  const published = row.published === null ? null : revision(row.published, source);
  const latest = revision(row.latest, source);
  const rejected = row.rejected === null ? null : revision(row.rejected, source);
  if ((!pending && row.pending !== null) || (!published && row.published !== null) || !latest ||
    (!rejected && row.rejected !== null) || (rejected && (pending || rejected.id !== latest.id)) ||
    !Array.isArray(row.recentEvents) || row.recentEvents.length > 10 ||
    (row.state === "withdrawn" && (pending || published || rejected))) return null;
  const events = row.recentEvents.map(event);
  if (events.some((entry) => !entry)) return null;
  const reply = row.reply === null ? null : object(row.reply, ["body", "publishedAt", "updatedAt"]);
  if (row.reply !== null && (!reply || !reviewReplyBodySchema(reply.body) || reviewReplyBodySchema(reply.body) !== reply.body ||
    !isModerationTimestamp(reply.publishedAt) || !isModerationTimestamp(reply.updatedAt))) return null;
  return { id: row.id as string, state: row.state as ModerationReview["state"], createdAt: row.createdAt, updatedAt: row.updatedAt,
    item: { productId: item.productId, productTitle: item.productTitle, variantTitle: item.variantTitle },
    verifiedPurchase: row.verifiedPurchase, source,
    pending, published, latest, rejected, recentEvents: events as ModerationEvent[],
    reply: reply ? { body: reply.body as string, publishedAt: reply.publishedAt as string, updatedAt: reply.updatedAt as string } : null };
}

function product(value: unknown): ModerationProduct | null {
  const row = object(value, ["productId", "productTitle"]);
  return row && isModerationProductId(row.productId) && text(row.productTitle, 255)
    ? { productId: row.productId, productTitle: row.productTitle } : null;
}

async function loadModerationProducts(admin: SupabaseClient, actor: string, shopId: string): Promise<ModerationProduct[]> {
  const { data, error } = await admin.rpc("store_review_moderation_products", { p_actor: actor, p_shop_id: shopId });
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (!Array.isArray(data) || data.length > 500) throw new StoreReviewDatabaseError();
  const rows = data.map(product);
  if (rows.some((row) => !row)) throw new StoreReviewDatabaseError();
  return rows as ModerationProduct[];
}

/** How many reviews the whole queue holds, with the same filter as its pages. */
async function countModerationReviews(admin: SupabaseClient, actor: string, shopId: string, query: ModerationQuery): Promise<number> {
  const { data, error } = await admin.rpc("store_review_moderation_count", {
    p_actor: actor, p_shop_id: shopId, p_filter: query.filter, p_product_id: query.productId,
  });
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) throw new StoreReviewDatabaseError();
  return data;
}

export async function loadReviewModerationPage(admin: SupabaseClient, actor: string, shopId: string, query: ModerationQuery): Promise<ModerationPage> {
  const [{ data, error }, products, total] = await Promise.all([admin.rpc("store_review_moderation_page_v5", {
    p_actor: actor, p_shop_id: shopId, p_filter: query.filter, p_product_id: query.productId, p_limit: 21,
    p_after_created_at: query.after?.createdAt ?? null, p_after_id: query.after?.id ?? null,
  }), loadModerationProducts(admin, actor, shopId),
  // Later pages continue a queue whose total the first page already reported.
  query.after ? null : countModerationReviews(admin, actor, shopId, query)]);
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (!Array.isArray(data) || data.length > 21) throw new StoreReviewDatabaseError();
  const rows = data.map(review);
  if (rows.some((row) => !row)) throw new StoreReviewDatabaseError();
  const reviews = (rows as ModerationReview[]).slice(0, 20);
  const last = reviews.at(-1);
  return { reviews, products, total, next: rows.length > 20 && last ? { id: last.id, createdAt: last.createdAt } : null };
}

export async function moderateReview(admin: SupabaseClient, actor: string, shopId: string, decision: ModerationDecision): Promise<boolean> {
  const { data, error } = await admin.rpc("store_moderate_review", {
    p_actor: actor, p_shop_id: shopId, p_review_id: decision.reviewId, p_expected_updated_at: decision.expectedUpdatedAt,
    p_action: decision.action, p_revision_id: decision.revisionId, p_note: decision.note,
  });
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (typeof data !== "boolean") throw new StoreReviewDatabaseError();
  return data;
}

export async function saveReviewReply(admin: SupabaseClient, actor: string, shopId: string, command: ReviewReplyCommand): Promise<boolean> {
  const { data, error } = await admin.rpc("store_save_review_reply", {
    p_actor: actor, p_shop_id: shopId, p_review_id: command.reviewId,
    p_expected_updated_at: command.expectedUpdatedAt, p_body: command.body,
  });
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (typeof data !== "boolean") throw new StoreReviewDatabaseError();
  return data;
}

const reviewPhotoBucket = "store-review-photos";

export type ReviewDeletionOutcome =
  | { deleted: false }
  | { deleted: true; photoCount: number; photosRemoved: boolean };

/**
 * Permanently deletes a review and records the audit row in one transaction,
 * then removes its private photo files. Storage cannot join the database
 * transaction, so a failed file removal leaves the review deleted and reports
 * `photosRemoved: false`; the files stay private and unreferenced.
 */
export async function deleteReview(admin: SupabaseClient, actor: string, shopId: string, command: ReviewDeletionCommand): Promise<ReviewDeletionOutcome> {
  const { data, error } = await admin.rpc("store_delete_review", {
    p_actor: actor, p_shop_id: shopId, p_review_id: command.reviewId,
    p_expected_updated_at: command.expectedUpdatedAt, p_reason: command.reason, p_note: command.note,
  });
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (data === null) return { deleted: false };
  if (!Array.isArray(data) || data.some((id) => !parseUuid(id))) throw new StoreReviewDatabaseError();
  const photoIds = data as string[];
  if (!photoIds.length) return { deleted: true, photoCount: 0, photosRemoved: true };
  const removed = await admin.storage.from(reviewPhotoBucket).remove(photoIds.map((id) => `${shopId}/${id}.webp`))
    .then(({ error: storageError }) => !storageError, () => false);
  return { deleted: true, photoCount: photoIds.length, photosRemoved: removed };
}

/** The same review predicate as the pending queue, including undecided current media. */
export async function countPendingReviews(admin: SupabaseClient, actor: string, shopId: string): Promise<number> {
  const { data, error } = await admin.rpc("store_pending_review_count", { p_actor: actor, p_shop_id: shopId });
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) throw new StoreReviewDatabaseError();
  return data;
}
