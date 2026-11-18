import { expect, test } from "@playwright/test";
import { evaluateReviewPurchase } from "../lib/customer-account/purchase-eligibility";
import { readCustomerPurchase } from "../lib/customer-account/purchase-reader";
import type { CustomerPurchase } from "../lib/customer-account/purchase-reader";
import { customerPurchasePage, purchaseLineId, purchaseOrderId, purchaseProductId } from "./fixtures/customer-purchase";

const references = { shopId: "123456", lineId: purchaseLineId, productId: purchaseProductId };
async function purchase(): Promise<CustomerPurchase> {
  const result = await readCustomerPurchase(async () => customerPurchasePage(), purchaseOrderId);
  if (result.status !== "found") throw new Error("Invalid synthetic purchase fixture");
  return result.purchase;
}

test("an owned paid physical line gets attribution from the exact purchased item", async () => {
  const data = await purchase();
  expect(evaluateReviewPurchase(data, references)).toEqual({ status: "eligible", purchase: {
    shopId: references.shopId, customerId: data.buyerId, orderId: purchaseOrderId, lineId: purchaseLineId,
    productId: purchaseProductId, variantId: data.lines[0].variantId, orderLabel: "#100", productName: "Ryan tee",
    variantTitle: "Blue / M", quantity: 1, fulfilledQuantity: 1,
  } });
});

test("a supplied product or line cannot change the verified purchase attribution", async () => {
  const data = await purchase();
  expect(evaluateReviewPurchase(data, { ...references, lineId: "another-line" })).toEqual({ status: "ineligible", reason: "not_found" });
  expect(evaluateReviewPurchase(data, { ...references, productId: "another-product" })).toEqual({ status: "ineligible", reason: "wrong_product" });
  data.lines[0].productId = null;
  expect(evaluateReviewPurchase(data, references)).toEqual({ status: "unavailable" });
});

test("nullable purchased variants remain attributed to their original product and line", async () => {
  const data = await purchase(); data.lines[0].variantId = null; data.lines[0].variantTitle = null;
  const result = evaluateReviewPurchase(data, references);
  expect(result.status).toBe("eligible");
  if (result.status === "eligible") expect(result.purchase).toMatchObject({ productId: purchaseProductId, lineId: purchaseLineId, variantId: null });
});

test("cancelled orders, unpaid purchases, gift cards, and nonphysical lines cannot qualify", async () => {
  const cancelled = await purchase(); cancelled.cancelledAt = "2026-11-17T12:00:00Z";
  expect(evaluateReviewPurchase(cancelled, references)).toEqual({ status: "ineligible", reason: "cancelled" });
  for (const status of ["AUTHORIZED", "EXPIRED", "PARTIALLY_PAID", "PENDING", "VOIDED"]) {
    const data = await purchase(); data.financialStatus = status;
    expect(evaluateReviewPurchase(data, references)).toEqual({ status: "ineligible", reason: "unpaid" });
  }
  for (const extra of [{ requiresShipping: false }, { giftCard: true }]) {
    const data = await purchase(); Object.assign(data.lines[0], extra);
    expect(evaluateReviewPurchase(data, references)).toEqual({ status: "ineligible", reason: "not_physical" });
  }
});

test("one line's fulfillment never makes a different purchased line eligible", async () => {
  const data = await purchase(); data.fulfillments[0].lines[0].lineId = "other-line";
  expect(evaluateReviewPurchase(data, references)).toEqual({ status: "ineligible", reason: "unfulfilled" });
  for (const status of ["CANCELLED", "ERROR", "FAILURE", "OPEN", "PENDING"]) {
    const data = await purchase(); data.fulfillments[0].status = status;
    expect(evaluateReviewPurchase(data, references)).toEqual({ status: "ineligible", reason: "unfulfilled" });
  }
});

test("split shipments qualify only after all units on the selected line are successfully fulfilled", async () => {
  const data = await purchase(); data.lines[0].quantity = 2; data.lines[0].refundableQuantity = 2;
  expect(evaluateReviewPurchase(data, references)).toEqual({ status: "ineligible", reason: "unfulfilled" });
  const second = structuredClone(data.fulfillments[0]); second.id = "second-fulfillment"; second.lines[0].id = "second-fulfillment-line";
  data.fulfillments.push(second);
  const result = evaluateReviewPurchase(data, references);
  expect(result.status).toBe("eligible");
  if (result.status === "eligible") expect(result.purchase).toMatchObject({ quantity: 2, fulfilledQuantity: 2 });
  data.fulfillments.push({ ...second, id: "overcounted" });
  expect(evaluateReviewPurchase(data, references)).toEqual({ status: "unavailable" });
});

test("unknown fulfillment facts, refunds, edits, and missing payment facts remain unavailable", async () => {
  for (const status of [null, "UNRECOGNIZED_STATUS"]) {
    const data = await purchase(); data.fulfillments[0].status = status;
    expect(evaluateReviewPurchase(data, references)).toEqual({ status: "unavailable" });
  }
  const missingQuantity = await purchase(); missingQuantity.fulfillments[0].lines[0].quantity = null;
  expect(evaluateReviewPurchase(missingQuantity, references)).toEqual({ status: "unavailable" });
  for (const status of [null, "REFUNDED", "PARTIALLY_REFUNDED", "FUTURE_STATUS"]) {
    const data = await purchase(); data.financialStatus = status;
    // Includes refunds after receipt: uncertainty is not permanent disqualification.
    expect(evaluateReviewPurchase(data, references)).toEqual({ status: "unavailable" });
  }
  const refundedLine = await purchase(); refundedLine.lines[0].refundableQuantity = 0;
  expect(evaluateReviewPurchase(refundedLine, references)).toEqual({ status: "unavailable" });
  const edited = await purchase(); edited.edited = true;
  expect(evaluateReviewPurchase(edited, references)).toEqual({ status: "unavailable" });
});
