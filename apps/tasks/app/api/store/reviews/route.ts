import { NextResponse } from "next/server";
import { reviewCommandSchema } from "@/lib/api-schema";
import { databaseFailure, privateResponse } from "@/lib/server/api-response";
import { readJson } from "@/lib/server/request";
import { authorizeStoreService } from "@/lib/server/store-service-authorization";
import { executeStoreReview, StoreReviewDatabaseError } from "@/lib/server/store-reviews/storage";

export const runtime = "nodejs";

/**
 * Private review storage for the storefront server. It shares the store
 * review service credential and pinned Shopify shop with customer sign-in, and
 * is refused for the personal PRD database the same way.
 */
export async function POST(request: Request) {
  const authorization = authorizeStoreService(request);
  if ("response" in authorization) return privateResponse(authorization.response);
  // Review text is at most 5,000 characters; 48 KiB covers it in any script.
  const parsed = await readJson(request, reviewCommandSchema, { source: "service", maxBytes: 48 * 1024 });
  if ("response" in parsed) return privateResponse(parsed.response);
  try {
    return privateResponse(NextResponse.json(await executeStoreReview(authorization.admin, authorization.scope.shopId, parsed.data)));
  } catch (error) {
    // Supabase error details may contain review text or buyer IDs. Log the code only.
    return privateResponse(databaseFailure(request, "store_reviews", {
      code: error instanceof StoreReviewDatabaseError ? error.code : undefined,
    }, { error: "Review storage is temporarily unavailable.", conflictError: "This review already exists." }));
  }
}
