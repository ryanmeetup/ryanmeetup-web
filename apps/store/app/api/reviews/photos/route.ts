import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { handleReviewPhoto } from "@/lib/review-photo-actions";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";
import { getReviewPhotoStaging } from "@/lib/review-photo-staging";
import { resolveRequestReviewProvider } from "@/lib/review-provider";
import { findReviewablePurchases } from "@/lib/review-purchases";
import { getProductTitleById } from "@/lib/shopify";

export const runtime = "nodejs";
export const maxDuration = 30;

function handle(request: Request) {
  const enabled = reviewPhotosEnabled() && resolveRequestReviewProvider(request) === "custom";
  return handleReviewPhoto(request, { enabled, staging: enabled ? getReviewPhotoStaging() : null,
    loadSession: () => getCustomerAccountSession(request), findPurchases: findReviewablePurchases, findProductTitle: getProductTitleById });
}
export const POST = handle;
export const DELETE = handle;
