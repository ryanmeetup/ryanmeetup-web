import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { findRecentReviewablePurchases } from "@/lib/review-purchases";
import { handleReviewSuggestionAction } from "@/lib/review-suggestion-actions";
import { getReviewSuggestionStorage } from "@/lib/review-suggestion-storage";

export const runtime = "nodejs";

export function POST(request: Request) {
  return handleReviewSuggestionAction(request, {
    loadSession: () => getCustomerAccountSession(request),
    storage: getReviewSuggestionStorage(), findRecent: findRecentReviewablePurchases,
  });
}
