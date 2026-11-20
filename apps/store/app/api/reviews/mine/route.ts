import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { handleMyReviewAction, handleMyReviewPage } from "@/lib/my-review-actions";
import { privateJson } from "@/lib/request-guard";
import { getReviewBackend } from "@/lib/review-backend";
import { resolveRequestReviewProvider } from "@/lib/review-provider";
import { findBuyerName } from "@/lib/review-purchases";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";

export const runtime = "nodejs";

// Sign-in works in any review mode now; managing custom reviews only makes sense while they're the store's reviews.
const closed = () => privateJson(503, { error: "Your reviews are temporarily unavailable. Please try again later." });
const deps = (request: Request) => ({ loadSession: () => getCustomerAccountSession(request), findBuyerName, backend: getReviewBackend(), photosEnabled: reviewPhotosEnabled() });

/** Edit or withdraw one of the signed-in buyer's reviews. */
export function POST(request: Request) {
  return resolveRequestReviewProvider(request) === "custom" ? handleMyReviewAction(request, deps(request)) : closed();
}

export function GET(request: Request) {
  return resolveRequestReviewProvider(request) === "custom" ? handleMyReviewPage(request, deps(request)) : closed();
}
