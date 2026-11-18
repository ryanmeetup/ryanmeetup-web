import { expect, test } from "@playwright/test";
import { maxCartLineQuantity, parseCartAction } from "../lib/cart-action";

const cartId = "gid://shopify/Cart/c1-abc?key=secret";
const lineId = "gid://shopify/CartLine/line-1?cart=c1-abc";
const merchandiseId = "gid://shopify/ProductVariant/123";

test("well-formed cart changes pass through unchanged", () => {
  expect(parseCartAction({ action: "get", cartId })).toEqual({ action: "get", cartId });
  expect(parseCartAction({ action: "add", merchandiseId, quantity: 2 })).toEqual({ action: "add", cartId: undefined, merchandiseId, quantity: 2 });
  expect(parseCartAction({ action: "add", cartId, merchandiseId, quantity: 1 })).toEqual({ action: "add", cartId, merchandiseId, quantity: 1 });
  expect(parseCartAction({ action: "update", cartId, lineId, quantity: maxCartLineQuantity })).toEqual({ action: "update", cartId, lineId, quantity: maxCartLineQuantity });
  expect(parseCartAction({ action: "remove", cartId, lineId })).toEqual({ action: "remove", cartId, lineId });
});

test("junk quantities, foreign IDs, and malformed bodies never reach Shopify", () => {
  for (const quantity of [0, -1, 1.5, maxCartLineQuantity + 1, "2", null]) {
    expect(parseCartAction({ action: "add", merchandiseId, quantity })).toBeNull();
    expect(parseCartAction({ action: "update", cartId, lineId, quantity })).toBeNull();
  }
  expect(parseCartAction({ action: "add", merchandiseId: "gid://shopify/Product/123", quantity: 1 })).toBeNull();
  expect(parseCartAction({ action: "add", cartId: "demo-cart", merchandiseId, quantity: 1 })).toBeNull();
  expect(parseCartAction({ action: "remove", cartId, lineId: merchandiseId })).toBeNull();
  expect(parseCartAction({ action: "get", cartId: `${cartId}\n` })).toBeNull();
  expect(parseCartAction({ action: "get", cartId: `gid://shopify/Cart/${"x".repeat(600)}` })).toBeNull();
  for (const body of [null, [], "get", { action: "delete", cartId }]) expect(parseCartAction(body)).toBeNull();
});
