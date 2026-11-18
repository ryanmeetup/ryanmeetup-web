import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeBuyerReviewCursor, encodeBuyerReviewCursor, decodeReviewCursor, encodeReviewCursor, publicReviewPageSchema, reviewResultSchema } from "@ryanmeetup/reviews";
import type { BuyerReview, PublicReview, ReviewCommand } from "@ryanmeetup/reviews";

export class StoreReviewDatabaseError extends Error {
  constructor(readonly code?: string) { super("Store review storage failed."); }
}

function check<T>(result: { data: T; error: { code?: string } | null }) {
  if (result.error) throw new StoreReviewDatabaseError(result.error.code);
  return result.data;
}

/**
 * Fixed operations only: no caller-selected table, column, function, or shop.
 * The shop comes from the backend's own configuration, never the command.
 */
export async function executeStoreReview(admin: SupabaseClient, shopId: string, command: ReviewCommand) {
  let data: unknown;
  switch (command.operation) {
    case "review.submit": {
      const { purchase, submission } = command;
      const rows = check(await admin.rpc("store_submit_review", {
        p_shop_id: shopId, p_subject: command.subject, p_order_id: purchase.orderId, p_line_id: purchase.lineId,
        p_product_id: purchase.productId, p_variant_id: purchase.variantId, p_product_title: purchase.productTitle,
        p_variant_title: purchase.variantTitle, p_rating: submission.rating, p_title: submission.title, p_body: submission.body,
        p_name_style: submission.nameStyle, p_display_name: command.displayName,
      })) as { review_id: string | null; outcome: string }[] | null;
      const row = rows?.[0];
      data = row ? { reviewId: row.review_id, outcome: row.outcome } : null;
      break;
    }
    case "review.edit": {
      const { submission } = command;
      data = check(await admin.rpc("store_edit_buyer_review", {
        p_review_id: command.reviewId, p_shop_id: shopId, p_subject: command.subject, p_expected_updated_at: command.expectedUpdatedAt, p_rating: submission.rating,
        p_title: submission.title, p_body: submission.body, p_name_style: submission.nameStyle, p_display_name: command.displayName,
      }));
      break;
    }
    case "review.withdraw":
      data = check(await admin.rpc("store_withdraw_buyer_review", { p_review_id: command.reviewId, p_shop_id: shopId, p_subject: command.subject, p_expected_updated_at: command.expectedUpdatedAt }));
      break;
    case "review.mine": {
      const rows = check(await admin.rpc("store_buyer_reviews", { p_shop_id: shopId, p_subject: command.subject, p_review_id: command.reviewId, p_limit: 1 }));
      if (!Array.isArray(rows) || rows.length > 1 || (rows.length === 1 && rows[0]?.id !== command.reviewId)) throw new StoreReviewDatabaseError();
      data = rows[0] ?? null;
      break;
    }
    case "reviews.mine": {
      const after = command.cursor ? decodeBuyerReviewCursor(command.cursor) : null;
      const rows = check(await admin.rpc("store_buyer_reviews", { p_shop_id: shopId, p_subject: command.subject, p_limit: 21,
        p_after_created_at: after?.createdAt ?? null, p_after_id: after?.id ?? null }));
      if (!Array.isArray(rows) || rows.length > 21) throw new StoreReviewDatabaseError();
      // Validate the extra row before it can influence a private cursor.
      const reviews: BuyerReview[] = [];
      for (const row of rows) {
        const parsed = reviewResultSchema("review.mine", { data: row });
        if (!parsed?.data) throw new StoreReviewDatabaseError();
        reviews.push(parsed.data);
      }
      const page = reviews.slice(0,20);
      const last = page.at(-1);
      data = { reviews: page, nextCursor: reviews.length > 20 && last ? encodeBuyerReviewCursor({ id:last.id,createdAt:last.createdAt }) : null };
      break;
    }
    case "reviews.reviewedLines":
      data = check(await admin.rpc("store_buyer_reviewed_lines", { p_shop_id:shopId,p_subject:command.subject,p_line_ids:command.lineIds }));
      if (!Array.isArray(data) || data.some((line) => !command.lineIds.includes(line))) throw new StoreReviewDatabaseError();
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
      if (!publicReviewPageSchema(data)) throw new StoreReviewDatabaseError();
      break;
    }
  }
  const parsed = reviewResultSchema(command.operation, { data });
  if (!parsed) throw new StoreReviewDatabaseError();
  return parsed;
}
