import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { handleReviewPhoto } from "@/lib/review-photo-actions";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";
import { getReviewPhotoStaging } from "@/lib/review-photo-staging";
import { findReviewablePurchases } from "@/lib/review-purchases";
import { getProductTitleById } from "@/lib/shopify";
import { handleReviewPhotoRead } from "@/lib/review-photo-reads";
import { getReviewPhotoReader } from "@/lib/review-photo-reader";

export const runtime = "nodejs";
export const maxDuration = 30;

function handle(request: Request) {
  const enabled = reviewPhotosEnabled();
  return handleReviewPhoto(request, { enabled, staging: enabled ? getReviewPhotoStaging() : null,
    loadSession: () => getCustomerAccountSession(request), findPurchases: findReviewablePurchases, findProductTitle: getProductTitleById });
}
export const POST = handle;
export const DELETE = handle;

export function GET(request: Request) {
  const enabled = reviewPhotosEnabled();
  return handleReviewPhotoRead(request, "preview", { enabled, reader: enabled ? getReviewPhotoReader() : null,
    loadSession: () => getCustomerAccountSession(request) });
}
