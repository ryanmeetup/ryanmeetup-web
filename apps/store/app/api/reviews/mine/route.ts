import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { handleMyReviewAction, handleMyReviewPage } from "@/lib/my-review-actions";
import { getReviewBackend } from "@/lib/review-backend";
import { findBuyerName } from "@/lib/review-purchases";

export const runtime = "nodejs";

/** Edit or withdraw one of the signed-in buyer's reviews. */
export function POST(request: Request) {
  return handleMyReviewAction(request, { loadSession: () => getCustomerAccountSession(request), findBuyerName, backend: getReviewBackend() });
}

export function GET(request: Request) {
  return handleMyReviewPage(request, { loadSession: () => getCustomerAccountSession(request), findBuyerName, backend: getReviewBackend() });
}
