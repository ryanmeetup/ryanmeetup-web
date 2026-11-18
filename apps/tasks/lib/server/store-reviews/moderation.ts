import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { reviewReplyBodySchema, reviewSubmissionSchema } from "@ryanmeetup/reviews";
import { parseUuid } from "@/lib/api-schema";
import { isModerationTimestamp } from "@/lib/store-reviews/moderation";
import type { ModerationDecision, ModerationEvent, ModerationPage, ModerationQuery, ModerationReview, ModerationRevision, ReviewReplyCommand } from "@/lib/store-reviews/moderation";
import { StoreReviewDatabaseError } from "./storage";

function object(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === keys.length && keys.every((key) => key in row) ? row : null;
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && [...value].length <= max && value === value.trim();
}
function revision(value: unknown): ModerationRevision | null {
  const row = object(value, ["id", "rating", "title", "body", "displayName", "submittedAt"]);
  if (!row || !parseUuid(row.id) || !isModerationTimestamp(row.submittedAt) || !text(row.displayName, 60)) return null;
  const content = reviewSubmissionSchema({ rating: row.rating, title: row.title, body: row.body, nameStyle: "anonymous" });
  if (!content || content.title !== row.title || content.body !== row.body) return null;
  return { id: row.id as string, rating: content.rating, title: content.title, body: content.body, displayName: row.displayName, submittedAt: row.submittedAt };
}
const eventActions = ["submitted", "resubmitted", "edited", "withdrawn", "approved", "rejected", "hidden", "restored", "reply_set", "reply_removed"];
function event(value: unknown): ModerationEvent | null {
  const row = object(value, ["action", "actorKind", "actor", "note", "createdAt"]);
  if (!row || !eventActions.includes(String(row.action)) || !isModerationTimestamp(row.createdAt) ||
    !["buyer", "staff"].includes(String(row.actorKind)) ||
    (row.actorKind === "buyer" ? row.actor !== null : !text(row.actor, 200)) ||
    (row.note !== null && !text(row.note, 1000))) return null;
  return row as ModerationEvent;
}
function review(value: unknown): ModerationReview | null {
  const row = object(value, ["id", "state", "createdAt", "updatedAt", "item", "pending", "published", "latest", "recentEvents", "reply"]);
  if (!row || !parseUuid(row.id) || !["active", "hidden", "withdrawn"].includes(String(row.state)) ||
    !isModerationTimestamp(row.createdAt) || !isModerationTimestamp(row.updatedAt)) return null;
  const item = object(row.item, ["productId", "productTitle", "variantTitle"]);
  if (!item || typeof item.productId !== "string" || !/^[1-9][0-9]{0,19}$/.test(item.productId) ||
    !text(item.productTitle, 255) || (item.variantTitle !== null && !text(item.variantTitle, 255))) return null;
  const pending = row.pending === null ? null : revision(row.pending);
  const published = row.published === null ? null : revision(row.published);
  const latest = revision(row.latest);
  if ((!pending && row.pending !== null) || (!published && row.published !== null) || !latest ||
    !Array.isArray(row.recentEvents) || row.recentEvents.length > 10 ||
    (row.state === "withdrawn" && (pending || published))) return null;
  const events = row.recentEvents.map(event);
  if (events.some((entry) => !entry)) return null;
  const reply = row.reply === null ? null : object(row.reply, ["body", "publishedAt", "updatedAt"]);
  if (row.reply !== null && (!reply || !reviewReplyBodySchema(reply.body) || reviewReplyBodySchema(reply.body) !== reply.body ||
    !isModerationTimestamp(reply.publishedAt) || !isModerationTimestamp(reply.updatedAt))) return null;
  return { id: row.id as string, state: row.state as ModerationReview["state"], createdAt: row.createdAt, updatedAt: row.updatedAt,
    item: { productId: item.productId, productTitle: item.productTitle, variantTitle: item.variantTitle },
    pending, published, latest, recentEvents: events as ModerationEvent[],
    reply: reply ? { body: reply.body as string, publishedAt: reply.publishedAt as string, updatedAt: reply.updatedAt as string } : null };
}

export async function loadReviewModerationPage(admin: SupabaseClient, actor: string, shopId: string, query: ModerationQuery): Promise<ModerationPage> {
  const { data, error } = await admin.rpc("store_review_moderation_page_v2", {
    p_actor: actor, p_shop_id: shopId, p_filter: query.filter, p_limit: 21,
    p_after_created_at: query.after?.createdAt ?? null, p_after_id: query.after?.id ?? null,
  });
  if (error) throw new StoreReviewDatabaseError(error.code);
  if (!Array.isArray(data) || data.length > 21) throw new StoreReviewDatabaseError();
  const rows = data.map(review);
  if (rows.some((row) => !row)) throw new StoreReviewDatabaseError();
  const reviews = (rows as ModerationReview[]).slice(0, 20);
  const last = reviews.at(-1);
  return { reviews, next: rows.length > 20 && last ? { id: last.id, createdAt: last.createdAt } : null };
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
