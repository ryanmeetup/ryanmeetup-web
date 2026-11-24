import { expect, test } from "@playwright/test";
import { cartActivityKey, orderActivityRows } from "../lib/product-activity";

const order = {
  id: 5550001, created_at: "2026-11-24T10:00:00-05:00", test: false, cancelled_at: null,
  email: "buyer@example.com", customer: { first_name: "Ryan" },
  line_items: [
    { id: 11, product_id: 15599296348271, quantity: 2 },
    { id: 12, product_id: null, quantity: 1 },
    { id: 13, product_id: 15664102932591, quantity: 0 },
  ],
};

test("an order becomes one anonymous sale row per product line", () => {
  expect(orderActivityRows("123", order)).toEqual([
    { shop_id: "123", kind: "sale", product_id: "15599296348271", quantity: 2, source_key: "order:5550001:11", occurred_at: "2026-11-24T15:00:00.000Z" },
  ]);
  expect(JSON.stringify(orderActivityRows("123", order))).not.toContain("buyer@example.com");
});

test("test and cancelled orders count for nothing, and junk is refused", () => {
  expect(orderActivityRows("123", { ...order, test: true })).toEqual([]);
  expect(orderActivityRows("123", { ...order, cancelled_at: "2026-11-24T11:00:00-05:00" })).toEqual([]);
  expect(orderActivityRows("123", { id: 1 })).toBeNull();
  expect(orderActivityRows("123", "order")).toBeNull();
});

test("a cart key is stable per cart and product and never holds the cart ID", () => {
  const cartId = "gid://shopify/Cart/abc123?key=secret";
  const key = cartActivityKey(cartId, "42");
  expect(key).toMatch(/^cart:[a-f0-9]{32}:42$/);
  expect(key).toBe(cartActivityKey(cartId, "42"));
  expect(key).not.toBe(cartActivityKey(`${cartId}x`, "42"));
  expect(key).not.toContain("abc123");
});
