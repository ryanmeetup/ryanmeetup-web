import { NextResponse } from "next/server";
import { databaseFailure, privateResponse } from "@/lib/server/api-response";
import { countPendingReviews } from "@/lib/server/store-reviews/moderation";
import { StoreReviewDatabaseError } from "@/lib/server/store-reviews/errors";
import { storeReviewStaffContext } from "@/lib/server/store-reviews/staff-context";

export const runtime = "nodejs";

/** The number on the sidebar's Store Reviews entry. Owner-only, never cached. */
export async function GET(request: Request) {
  const authorized = await storeReviewStaffContext();
  if ("response" in authorized) return privateResponse(authorized.response);
  try {
    return privateResponse(NextResponse.json({ pending: await countPendingReviews(authorized.admin, authorized.shopId) }));
  } catch (error) {
    return privateResponse(databaseFailure(request, "store_review_pending_count", {
      code: error instanceof StoreReviewDatabaseError ? error.code : undefined,
    }, { error: "The pending review count is temporarily unavailable." }));
  }
}
