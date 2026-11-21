import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { handleMyReviewAction, handleMyReviewPage } from "@/lib/my-review-actions";
import { getReviewBackend } from "@/lib/review-backend";
import { findBuyerName } from "@/lib/review-purchases";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";
import { getProductCardsByIds } from "@/lib/shopify";
import { getReviewWriteLimiter } from "@/lib/review-write-limits";

export const runtime = "nodejs";

const deps = (request: Request) => ({ loadSession: () => getCustomerAccountSession(request), findBuyerName, backend: getReviewBackend(), photosEnabled: reviewPhotosEnabled(), productCards: getProductCardsByIds });

/** Edit or withdraw one of the signed-in buyer's reviews. */
export function POST(request: Request) {
  return handleMyReviewAction(request, { ...deps(request), limitWrites: getReviewWriteLimiter() });
}

export function GET(request: Request) {
  return handleMyReviewPage(request, deps(request));
}
