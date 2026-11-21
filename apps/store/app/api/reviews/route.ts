import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { submitCustomReview } from "@/lib/custom-review-submission";
import { getReviewBackend } from "@/lib/review-backend";
import { findBuyerName, findReviewablePurchases } from "@/lib/review-purchases";
import { getProductTitleById } from "@/lib/shopify";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";
import { getReviewWriteLimiter } from "@/lib/review-write-limits";

/** Collection authenticates the buyer and checks eligibility server-side. */
export async function POST(request: Request) {
  return submitCustomReview(request, {
    loadSession: () => getCustomerAccountSession(request), findPurchases: findReviewablePurchases,
    findBuyerName, findProductTitle: getProductTitleById, backend: getReviewBackend(),
    photosEnabled: reviewPhotosEnabled(), limitWrites: getReviewWriteLimiter(),
  });
}
