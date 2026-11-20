import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { handleMyReviewAction, handleMyReviewPage } from "@/lib/my-review-actions";
import { getReviewBackend } from "@/lib/review-backend";
import { findBuyerName } from "@/lib/review-purchases";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";

export const runtime = "nodejs";

const deps = (request: Request) => ({ loadSession: () => getCustomerAccountSession(request), findBuyerName, backend: getReviewBackend(), photosEnabled: reviewPhotosEnabled() });

/** Edit or withdraw one of the signed-in buyer's reviews. */
export function POST(request: Request) {
  return handleMyReviewAction(request, deps(request));
}

export function GET(request: Request) {
  return handleMyReviewPage(request, deps(request));
}
