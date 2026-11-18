import { expect, test } from "@playwright/test";
import { readCustomerPurchase } from "../lib/customer-account/purchase-reader";
import { reviewPurchaseQuery } from "../lib/customer-account/purchase-query";
import { customerPurchasePage, purchaseOrderId, purchaseLineId, purchaseBuyerId } from "./fixtures/customer-purchase";

test("purchase lookup anchors ownership to the token's customer and projects only needed fields", async () => {
  const page = { ...customerPurchasePage(), secret: "never-retain" };
  Object.assign(page.order, { email: "private@example.test", shippingAddress: { address1: "private" } });
  const result = await readCustomerPurchase(async (document, variables) => {
    expect(document).toBe(reviewPurchaseQuery); expect(variables.orderId).toBe(purchaseOrderId); return page;
  }, purchaseOrderId);
  expect(result.status).toBe("found");
  if (result.status !== "found") throw new Error("Expected synthetic purchase");
  expect(result.purchase).toMatchObject({ buyerId: purchaseBuyerId, orderId: purchaseOrderId, orderLabel: "#100", lines: [{ id: purchaseLineId }] });
  expect(JSON.stringify(result)).not.toContain("private"); expect(JSON.stringify(result)).not.toContain("never-retain");
});

test("not-found, not-owned, and unavailable are distinct without returning other buyers' data", async () => {
  const page = customerPurchasePage(); page.order.customer.id = "other-buyer";
  expect(await readCustomerPurchase(async () => page, purchaseOrderId)).toEqual({ status: "not_owned" });
  expect(await readCustomerPurchase(async () => ({ customer: { id: purchaseBuyerId }, order: null }), purchaseOrderId)).toEqual({ status: "not_found" });
  expect(await readCustomerPurchase(async () => { throw new Error("private-provider-error"); }, purchaseOrderId)).toEqual({ status: "unavailable" });
  expect(await readCustomerPurchase(async () => ({ customer: null, order: null }), purchaseOrderId)).toEqual({ status: "unavailable" });
});

test("line and fulfillment pages advance independently and skip completed connections", async () => {
  const first = customerPurchasePage(); first.order.fulfillments.nodes = [];
  first.order.lineItems.pageInfo = { hasNextPage: true, endCursor: "line-page-1" };
  const second = customerPurchasePage(); second.order.lineItems.nodes[0].id = "another-line";
  second.order.fulfillments.nodes = [];
  const requests: Record<string, unknown>[] = [];
  const result = await readCustomerPurchase(async (_document, variables) => {
    requests.push(variables); return requests.length === 1 ? first : second;
  }, purchaseOrderId);
  expect(result.status).toBe("found");
  expect(requests[1]).toMatchObject({ linesAfter: "line-page-1", readLines: true, readFulfillments: false });
  if (result.status === "found") expect(result.purchase.lines.map(({ id }) => id)).toEqual([purchaseLineId, "another-line"]);
});

test("split fulfillments are read across all outer pages", async () => {
  const first = customerPurchasePage(); first.order.fulfillments.pageInfo = { hasNextPage: true, endCursor: "fulfillment-page-1" };
  const second = customerPurchasePage(); second.order.fulfillments.nodes[0].id = "second-fulfillment";
  second.order.fulfillments.nodes[0].fulfillmentLineItems.nodes[0].id = "second-fulfillment-line";
  let requests = 0;
  const result = await readCustomerPurchase(async (_document, variables) => {
    requests++;
    if (requests === 2) expect(variables).toMatchObject({ readLines: false, readFulfillments: true, fulfillmentsAfter: "fulfillment-page-1" });
    return requests === 1 ? first : second;
  }, purchaseOrderId);
  expect(result.status).toBe("found");
  if (result.status === "found") expect(result.purchase.fulfillments).toHaveLength(2);
});

test("truncated nested fulfillment lines cannot masquerade as a complete exact-line lookup", async () => {
  const page = customerPurchasePage();
  page.order.fulfillments.nodes[0].fulfillmentLineItems.pageInfo = { hasNextPage: true, endCursor: "more-children" };
  expect(await readCustomerPurchase(async () => page, purchaseOrderId)).toEqual({ status: "unavailable" });
});

test("order changes or disappearance during pagination never produce mixed evidence", async () => {
  for (const change of ["updated", "buyer", "disappeared"]) {
    const first = customerPurchasePage(); first.order.lineItems.pageInfo = { hasNextPage: true, endCursor: "next" };
    const second = customerPurchasePage(); second.order.lineItems.nodes[0].id = "another-line";
    if (change === "updated") second.order.updatedAt = "2026-11-17T12:01:00.000Z";
    if (change === "buyer") { second.customer.id = "other-buyer"; second.order.customer.id = "other-buyer"; }
    let calls = 0;
    expect(await readCustomerPurchase(async () => ++calls === 1 ? first : change === "disappeared" ? { ...second, order: null } : second, purchaseOrderId)).toEqual({ status: "unavailable" });
  }
});

test("duplicate records, stalled cursors, malformed quantities, and broken line links fail closed", async () => {
  const duplicate = customerPurchasePage(); duplicate.order.lineItems.nodes.push(duplicate.order.lineItems.nodes[0]);
  const broken = customerPurchasePage(); broken.order.fulfillments.nodes[0].fulfillmentLineItems.nodes[0].lineItem.id = "line-outside-order";
  const badQuantity = customerPurchasePage(); badQuantity.order.lineItems.nodes[0].refundableQuantity = 2;
  const wrongOrder = customerPurchasePage(); wrongOrder.order.id = "another-order";
  const missingCursor = customerPurchasePage(); missingCursor.order.lineItems.pageInfo.hasNextPage = true;
  for (const page of [duplicate, broken, badQuantity, wrongOrder, missingCursor]) {
    expect(await readCustomerPurchase(async () => page, purchaseOrderId)).toEqual({ status: "unavailable" });
  }
});

test("pagination has a finite budget and cannot loop on a repeated cursor", async () => {
  let calls = 0;
  const query = async () => {
    const page = customerPurchasePage(); page.order.fulfillments.nodes = [];
    page.order.lineItems.nodes[0].id = `line-${++calls}`;
    page.order.lineItems.pageInfo = { hasNextPage: true, endCursor: `cursor-${calls}` }; return page;
  };
  expect(await readCustomerPurchase(query, purchaseOrderId)).toEqual({ status: "unavailable" }); expect(calls).toBe(10);
  calls = 0;
  expect(await readCustomerPurchase(async () => { const page = await query(); page.order.lineItems.pageInfo.endCursor = "repeated"; return page; }, purchaseOrderId)).toEqual({ status: "unavailable" });
  expect(calls).toBe(2);
});
