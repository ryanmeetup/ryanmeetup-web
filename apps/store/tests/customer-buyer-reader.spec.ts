import { expect, test } from "@playwright/test";
import { readReviewBuyer, readReviewOrderCandidates } from "../lib/customer-account/buyer-reader";
import { reviewBuyerQuery, reviewOrderCandidatesQuery } from "../lib/customer-account/buyer-queries";

function page() {
  return { customer: { id: "gid://shopify/Customer/1", firstName: "  Ryan  ", lastName: "Le", orders: {
    nodes: [{ id: "gid://shopify/Order/2", updatedAt: "2026-11-17T12:00:00Z", lineItems: {
      nodes: [{ id: "gid://shopify/LineItem/3", productId: "gid://shopify/Product/4" as string | null }],
      pageInfo: { hasNextPage: false, endCursor: null as string | null },
    } }], pageInfo: { hasNextPage: false, endCursor: null as string | null },
  } } };
}

test("buyer identity projects only account ID and sanitized nullable names", async () => {
  expect(await readReviewBuyer(async (document) => {
    expect(document).toBe(reviewBuyerQuery);
    return { customer: { id: "buyer", firstName: " Ryan\nRyan ", lastName: null, emailAddress: "private" } };
  })).toEqual({ id: "buyer", firstName: "Ryan Ryan", lastName: null });
  expect(await readReviewBuyer(async () => ({ customer: { id: "buyer", firstName: null, lastName: "  " } }))).toEqual({ id: "buyer", firstName: null, lastName: null });
  expect(await readReviewBuyer(async () => ({ customer: { id: "buyer" } }))).toBeNull();
  expect(await readReviewBuyer(async () => { throw new Error("private-provider-error"); })).toBeNull();
});

test("order discovery paginates and records incomplete line references for exact verification", async () => {
  let calls = 0;
  const result = await readReviewOrderCandidates(async (document, variables) => {
    expect(document).toBe(reviewOrderCandidatesQuery);
    const value = page(); calls++;
    if (calls === 1) {
      value.customer.orders.pageInfo = { hasNextPage: true, endCursor: "orders-after-1" };
      value.customer.orders.nodes[0].lineItems.pageInfo = { hasNextPage: true, endCursor: "line-after-50" };
    } else {
      expect(variables.after).toBe("orders-after-1");
      value.customer.orders.nodes[0].id = "second-order";
    }
    return value;
  });
  expect(result?.buyer).toEqual({ id: "gid://shopify/Customer/1", firstName: "Ryan", lastName: "Le" });
  expect(result?.orders.map(({ completeLines }) => completeLines)).toEqual([false, true]);
  expect(calls).toBe(2);
});

test("missing pages, repeated IDs/cursors, malformed references, or changing identity remain unavailable", async () => {
  const duplicate = page(); duplicate.customer.orders.nodes.push(duplicate.customer.orders.nodes[0]);
  const duplicateLines = page(); duplicateLines.customer.orders.nodes[0].lineItems.nodes.push(duplicateLines.customer.orders.nodes[0].lineItems.nodes[0]);
  const noCursor = page(); noCursor.customer.orders.pageInfo.hasNextPage = true;
  const badDate = page(); badDate.customer.orders.nodes[0].updatedAt = "not-a-date";
  for (const value of [duplicate, duplicateLines, noCursor, badDate]) expect(await readReviewOrderCandidates(async () => value)).toBeNull();
  for (const change of ["buyer", "name", "cursor"]) {
    let calls = 0;
    expect(await readReviewOrderCandidates(async () => {
      const value = page(); value.customer.orders.nodes[0].id = `order-${++calls}`;
      value.customer.orders.pageInfo = { hasNextPage: true, endCursor: change === "cursor" ? "repeated" : `cursor-${calls}` };
      if (calls > 1 && change === "buyer") value.customer.id = "another-buyer";
      if (calls > 1 && change === "name") value.customer.firstName = "Changed";
      return value;
    })).toBeNull();
    expect(calls).toBe(2);
  }
});

test("a complete empty history is valid while the discovery request budget cannot look empty", async () => {
  const empty = page(); empty.customer.orders.nodes = [];
  expect((await readReviewOrderCandidates(async () => empty))?.orders).toEqual([]);
  let calls = 0;
  expect(await readReviewOrderCandidates(async () => {
    const value = page(); value.customer.orders.nodes[0].id = `order-${++calls}`;
    value.customer.orders.pageInfo = { hasNextPage: true, endCursor: `cursor-${calls}` }; return value;
  })).toBeNull();
  expect(calls).toBe(10);
});
