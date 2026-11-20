import { resolveRequestReviewProvider } from "@/lib/review-provider";
import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { submitCustomReview } from "@/lib/custom-review-submission";
import { getReviewBackend } from "@/lib/review-backend";
import { findBuyerName, findReviewablePurchases } from "@/lib/review-purchases";
import { getProductTitleById } from "@/lib/shopify";
import { privateJson } from "@/lib/request-guard";

/**
 * Custom collection authenticates the buyer and checks eligibility server-side.
 * The legacy anonymous Judge.me relay is retired in every provider mode,
 * including localhost overrides. Judge.me reads and its hosted account link
 * are independent of this endpoint.
 */
export async function POST(request: Request) {
  const provider = resolveRequestReviewProvider(request);
  if (provider === "custom") {
    return submitCustomReview(request, {
      loadSession: () => getCustomerAccountSession(request), findPurchases: findReviewablePurchases,
      findBuyerName, findProductTitle: getProductTitleById, backend: getReviewBackend(),
    });
  }
  if (provider === "judgeme") return privateJson(410, { error: "Please open your customer account to leave a review." });
  return privateJson(503, { error: "Review collection is temporarily unavailable. Please try again later." });
}
