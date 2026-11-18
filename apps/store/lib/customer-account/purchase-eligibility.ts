import { customerPurchaseId } from "./purchase-reader";
import type { CustomerPurchase } from "./purchase-reader";

/** Private verified attribution. Re-fetch on every write; never trust this from a browser. */
export type EligibleReviewPurchase = {
  shopId: string; customerId: string; orderId: string; lineId: string; productId: string; variantId: string | null;
  orderLabel: string; productName: string; variantTitle: string | null; quantity: number; fulfilledQuantity: number;
};
/**
 * Why a line can't be reviewed. `unfulfilled` and `unpaid` can still change;
 * `refunded`, `edited`, and `unverifiable` are lasting states the buyer has to
 * raise with the store, so they are reasons, never a lookup failure.
 */
export type ReviewIneligibleReason =
  | "not_found" | "not_owned" | "wrong_product" | "cancelled" | "not_physical" | "unpaid" | "unfulfilled"
  | "refunded" | "edited" | "unverifiable";
export type ReviewPurchaseEligibility =
  | { status: "eligible"; purchase: EligibleReviewPurchase }
  | { status: "ineligible"; reason: ReviewIneligibleReason }
  | { status: "sign_in_required" | "unavailable" };

const ineligible = (reason: ReviewIneligibleReason) => ({ status: "ineligible", reason }) as const;

/**
 * Exact-line rules. Only an invalid shop configuration is `unavailable`; every
 * fact about the order itself produces a verdict, so one unusual order can't
 * close reviews for the buyer indefinitely.
 */
export function evaluateReviewPurchase(purchase: CustomerPurchase, { shopId, lineId, productId }: {
  shopId: string; lineId: string; productId: string;
}): ReviewPurchaseEligibility {
  if (!/^[1-9][0-9]*$/.test(shopId)) return { status: "unavailable" };
  if (!customerPurchaseId(lineId) || !customerPurchaseId(productId)) return ineligible("not_found");
  const line = purchase.lines.find((candidate) => candidate.id === lineId);
  if (!line) return ineligible("not_found");
  // A deleted product can't be matched to this one.
  if (line.productId === null) return ineligible("unverifiable");
  if (line.productId !== productId) return ineligible("wrong_product");
  if (purchase.cancelledAt !== null) return ineligible("cancelled");
  if (!line.requiresShipping || line.giftCard) return ineligible("not_physical");
  if (line.quantity <= 0) return ineligible("not_found");
  // An edit can move units between lines; these fields can't show which survived.
  if (purchase.edited) return ineligible("edited");
  if (["AUTHORIZED", "EXPIRED", "PARTIALLY_PAID", "PENDING", "VOIDED"].includes(purchase.financialStatus ?? "")) return ineligible("unpaid");
  // A refund on another line leaves this one paid in full. The query can't
  // date a refund against delivery, so any refund on this line needs a person.
  if (line.refundableQuantity !== line.quantity || purchase.financialStatus === "REFUNDED") return ineligible("refunded");
  if (purchase.financialStatus !== "PAID" && purchase.financialStatus !== "PARTIALLY_REFUNDED") return ineligible("unverifiable");
  let fulfilledQuantity = 0;
  for (const fulfillment of purchase.fulfillments) {
    const entries = fulfillment.lines.filter((entry) => entry.lineId === lineId);
    if (!entries.length) continue;
    if (["CANCELLED", "ERROR", "FAILURE", "OPEN", "PENDING"].includes(fulfillment.status ?? "")) continue;
    if (fulfillment.status !== "SUCCESS") return ineligible("unverifiable");
    for (const entry of entries) {
      if (entry.quantity === null) return ineligible("unverifiable");
      fulfilledQuantity += entry.quantity;
    }
  }
  if (!Number.isSafeInteger(fulfilledQuantity) || fulfilledQuantity > line.quantity) return ineligible("unverifiable");
  if (fulfilledQuantity < line.quantity) return ineligible("unfulfilled");
  return { status: "eligible", purchase: { shopId, customerId: purchase.buyerId, orderId: purchase.orderId, lineId: line.id,
    productId: line.productId, variantId: line.variantId, orderLabel: purchase.orderLabel, productName: line.name,
    variantTitle: line.variantTitle, quantity: line.quantity, fulfilledQuantity } };
}
