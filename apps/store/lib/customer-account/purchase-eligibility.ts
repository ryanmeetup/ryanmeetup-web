import { customerPurchaseId } from "./purchase-reader";
import type { CustomerPurchase } from "./purchase-reader";

/** Private verified attribution. Re-fetch on every write; never trust this from a browser. */
export type EligibleReviewPurchase = {
  shopId: string; customerId: string; orderId: string; lineId: string; productId: string; variantId: string | null;
  orderLabel: string; productName: string; variantTitle: string | null; quantity: number; fulfilledQuantity: number;
};
export type ReviewPurchaseEligibility =
  | { status: "eligible"; purchase: EligibleReviewPurchase }
  | { status: "ineligible"; reason: "not_found" | "not_owned" | "wrong_product" | "cancelled" | "not_physical" | "unpaid" | "unfulfilled" }
  | { status: "sign_in_required" | "unavailable" };

/** Initial unambiguous subset only; refund/edit chronology still needs live proof. */
export function evaluateReviewPurchase(purchase: CustomerPurchase, { shopId, lineId, productId }: {
  shopId: string; lineId: string; productId: string;
}): ReviewPurchaseEligibility {
  if (!/^[1-9][0-9]*$/.test(shopId)) return { status: "unavailable" };
  if (!customerPurchaseId(lineId) || !customerPurchaseId(productId)) return { status: "ineligible", reason: "not_found" };
  const line = purchase.lines.find((candidate) => candidate.id === lineId);
  if (!line) return { status: "ineligible", reason: "not_found" };
  if (line.productId === null) return { status: "unavailable" };
  if (line.productId !== productId) return { status: "ineligible", reason: "wrong_product" };
  if (purchase.cancelledAt !== null) return { status: "ineligible", reason: "cancelled" };
  if (!line.requiresShipping || line.giftCard) return { status: "ineligible", reason: "not_physical" };
  if (line.quantity <= 0) return { status: "ineligible", reason: "not_found" };
  if (purchase.edited) return { status: "unavailable" };
  if (["AUTHORIZED", "EXPIRED", "PARTIALLY_PAID", "PENDING", "VOIDED"].includes(purchase.financialStatus ?? "")) return { status: "ineligible", reason: "unpaid" };
  // Refunds after receipt must not permanently disqualify feedback. These
  // fields alone do not prove the per-line refund/receipt chronology.
  if (purchase.financialStatus !== "PAID" || line.refundableQuantity !== line.quantity) return { status: "unavailable" };
  let fulfilledQuantity = 0;
  for (const fulfillment of purchase.fulfillments) {
    const entries = fulfillment.lines.filter((entry) => entry.lineId === lineId);
    if (!entries.length) continue;
    if (["CANCELLED", "ERROR", "FAILURE", "OPEN", "PENDING"].includes(fulfillment.status ?? "")) continue;
    if (fulfillment.status !== "SUCCESS") return { status: "unavailable" };
    for (const entry of entries) {
      if (entry.quantity === null) return { status: "unavailable" };
      fulfilledQuantity += entry.quantity;
    }
  }
  if (!Number.isSafeInteger(fulfilledQuantity) || fulfilledQuantity > line.quantity) return { status: "unavailable" };
  if (fulfilledQuantity < line.quantity) return { status: "ineligible", reason: "unfulfilled" };
  return { status: "eligible", purchase: { shopId, customerId: purchase.buyerId, orderId: purchase.orderId, lineId: line.id,
    productId: line.productId, variantId: line.variantId, orderLabel: purchase.orderLabel, productName: line.name,
    variantTitle: line.variantTitle, quantity: line.quantity, fulfilledQuantity } };
}
