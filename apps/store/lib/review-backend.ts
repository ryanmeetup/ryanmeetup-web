import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buyerReviewRow, decodeBuyerReviewCursor, decodeReviewCursor, encodeBuyerReviewCursor, encodeReviewCursor, publicReviewPageSchema,
  reviewCommandSchema, reviewResultSchema,
} from "@ryanmeetup/reviews";
import type { BuyerReview, PublicReview, ReviewCommand, ReviewResults } from "@ryanmeetup/reviews";
import { getStoreDatabase, getStoreShopId } from "./store-database";
import { reportReviewStorageFailure } from "./review-diagnostics";
import type { ReviewStorageFailure } from "./review-diagnostics";

/** Database failures carry only the Postgres code; row values and messages may hold review text or buyer IDs. */
export class ReviewBackendError extends Error {
  constructor(readonly code?: string, readonly failure: ReviewStorageFailure = "invalid_response") {
    super("Review storage is temporarily unavailable.");
  }
}

function check<T>(result: { data: T; error: { code?: string } | null }) {
  if (result.error) throw new ReviewBackendError(result.error.code, "storage_error");
  return result.data;
}

/**
 * Fixed operations only: no caller-selected table, column, function, or shop.
 * The shop comes from the store's own configuration, never the command.
 */
async function executeStoreReview(admin: SupabaseClient, shopId: string, command: ReviewCommand) {
  let data: unknown;
  switch (command.operation) {
    case "review.submit": {
      const { purchase, submission } = command;
      const rows = check(await admin.rpc(command.photoIds === undefined ? "store_submit_review" : "store_submit_review_with_photos", {
        p_shop_id: shopId, p_subject: command.subject, p_order_id: purchase.orderId, p_line_id: purchase.lineId,
        p_product_id: purchase.productId, p_variant_id: purchase.variantId, p_product_title: purchase.productTitle,
        p_variant_title: purchase.variantTitle, p_rating: submission.rating, p_title: submission.title, p_body: submission.body,
        p_name_style: submission.nameStyle, p_display_name: command.displayName,
        ...(command.photoIds === undefined ? {} : { p_photo_ids: command.photoIds }),
      })) as { review_id: string | null; outcome: string }[] | null;
      const row = rows?.[0];
      data = row ? { reviewId: row.review_id, outcome: row.outcome } : null;
      break;
    }
    case "review.edit": {
      const { submission } = command;
      data = check(await admin.rpc(command.photoIds === undefined ? "store_edit_buyer_review" : "store_edit_buyer_review_with_photos", {
        p_review_id: command.reviewId, p_shop_id: shopId, p_subject: command.subject, p_expected_updated_at: command.expectedUpdatedAt, p_rating: submission.rating,
        p_title: submission.title, p_body: submission.body, p_name_style: submission.nameStyle, p_display_name: command.displayName,
        ...(command.photoIds === undefined ? {} : { p_photo_ids: command.photoIds }),
      }));
      break;
    }
    case "review.withdraw":
      data = check(await admin.rpc("store_withdraw_buyer_review", { p_review_id: command.reviewId, p_shop_id: shopId, p_subject: command.subject, p_expected_updated_at: command.expectedUpdatedAt }));
      break;
    case "review.mine": {
      const rows = check(await admin.rpc("store_buyer_reviews", { p_shop_id: shopId, p_subject: command.subject, p_review_id: command.reviewId, p_limit: 1 }));
      if (!Array.isArray(rows) || rows.length > 1 || (rows.length === 1 && rows[0]?.id !== command.reviewId)) throw new ReviewBackendError();
      data = rows.length ? buyerReviewRow(rows[0]) : null;
      break;
    }
    case "reviews.mine": {
      const after = command.cursor ? decodeBuyerReviewCursor(command.cursor) : null;
      const rows = check(await admin.rpc("store_buyer_reviews", { p_shop_id: shopId, p_subject: command.subject, p_limit: 21,
        p_after_created_at: after?.createdAt ?? null, p_after_id: after?.id ?? null }));
      if (!Array.isArray(rows) || rows.length > 21) throw new ReviewBackendError();
      // Validate the extra row before it can influence a private cursor.
      const reviews: BuyerReview[] = [];
      for (const row of rows) {
        const parsed = reviewResultSchema("review.mine", { data: buyerReviewRow(row) });
        if (!parsed?.data) throw new ReviewBackendError();
        reviews.push(parsed.data);
      }
      const page = reviews.slice(0,20);
      const last = page.at(-1);
      data = { reviews: page, nextCursor: reviews.length > 20 && last ? encodeBuyerReviewCursor({ id:last.id,createdAt:last.createdAt }) : null };
      break;
    }
    case "reviews.reviewedProducts":
      data = check(await admin.rpc("store_buyer_reviewed_products", { p_shop_id: shopId, p_subject: command.subject, p_product_ids: command.productIds }));
      if (!Array.isArray(data) || data.some((product) => !command.productIds.includes(product))) throw new ReviewBackendError();
      break;
    case "reviews.reviewedLines":
      data = check(await admin.rpc("store_buyer_reviewed_lines", { p_shop_id:shopId,p_subject:command.subject,p_line_ids:command.lineIds }));
      if (!Array.isArray(data) || data.some((line) => !command.lineIds.includes(line))) throw new ReviewBackendError();
      break;
    case "reviews.page": {
      const after = command.cursor ? decodeReviewCursor(command.cursor) : null;
      const [summary, rows] = await Promise.all([
        admin.rpc("store_review_summary", { p_shop_id: shopId, p_product_ids: command.productIds }),
        // One extra row tells us whether another page exists.
        admin.rpc("store_public_reviews", {
          p_shop_id: shopId, p_product_ids: command.productIds, p_limit: command.limit + 1,
          p_after_published_at: after?.publishedAt ?? null, p_after_id: after?.id ?? null,
        }),
      ]);
      const reviews = (check(rows) ?? []) as PublicReview[];
      const page = reviews.slice(0, command.limit);
      const last = page.at(-1);
      data = {
        scope: { productIds: command.productIds },
        summary: check(summary),
        reviews: page,
        nextCursor: reviews.length > command.limit && last ? encodeReviewCursor({ publishedAt: last.publishedAt, id: last.id }) : null,
      };
      // A page that fails the public contract is never sent, even from our own database.
      if (!publicReviewPageSchema(data)) throw new ReviewBackendError();
      break;
    }
  }
  const parsed = reviewResultSchema(command.operation, { data });
  if (!parsed) throw new ReviewBackendError();
  return parsed;
}

/**
 * Server-only review storage in the shared RMT database. Commands are checked
 * before they run and results before they are used, so every failure,
 * including an unexpected row, surfaces as ReviewBackendError.
 */
export function createReviewBackend({ database, shopId }: { database: SupabaseClient; shopId: string }) {
  return async function execute<Sent extends ReviewCommand>(command: Sent): Promise<ReviewResults[Sent["operation"]]> {
    if (!reviewCommandSchema(command)) throw new ReviewBackendError();
    try {
      return (await executeStoreReview(database, shopId, command)).data as ReviewResults[Sent["operation"]];
    } catch (error) {
      const failure = error instanceof ReviewBackendError ? error : new ReviewBackendError(undefined, "unexpected_error");
      reportReviewStorageFailure(command.operation, failure.failure, failure.code);
      throw failure;
    }
  };
}

export type ReviewBackend = ReturnType<typeof createReviewBackend>;

/** The configured review storage, or null when the database or shop isn't set up here. */
export function getReviewBackend() {
  const database = getStoreDatabase();
  const shopId = getStoreShopId();
  return database && shopId ? createReviewBackend({ database, shopId }) : null;
}
