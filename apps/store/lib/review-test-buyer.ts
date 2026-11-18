import { readCookie } from "./request-guard";
import type { ReviewEligibility } from "./review-purchases";
import { isReviewPreviewEnabled, parseReviewPreviewChoice, requestHost, reviewPreviewCookie } from "./review-provider";

/**
 * A pretend signed-in buyer for localhost review testing. Its reviews are
 * saved for real, under one fixed subject with one synthetic order line per
 * product, and go through moderation like any other. Shopify sign-in and the
 * purchase lookup are the only steps it skips.
 */
export const testBuyerSubject = "local-test-buyer";
export type TestBuyerSession = { subject: string };

export async function loadTestBuyerSession() {
  return { status: "authenticated" as const, session: { subject: testBuyerSubject } };
}

/** One shipped, unrefunded purchase of any product. `productId` is already numeric. */
export async function findTestBuyerPurchases(_session: TestBuyerSession, productId: string): Promise<ReviewEligibility> {
  return {
    status: "eligible",
    buyer: { firstName: "Ryan", lastName: "Tester" },
    purchases: [{ orderId: "1", lineId: productId, productId, variantId: null, productTitle: `Test product ${productId}`, variantTitle: null, label: "Test order" }],
  };
}

/** True only on localhost review testing with the test buyer chosen; never on a deployment. */
export function isTestBuyerRequest(request: Request) {
  return isReviewPreviewEnabled(requestHost(request)) && parseReviewPreviewChoice(readCookie(request, reviewPreviewCookie)) === "custom-test";
}
