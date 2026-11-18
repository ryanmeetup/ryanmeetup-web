import { expect, test } from "@playwright/test";
import { parseStoredCart } from "../lib/stored-cart";

const money = { amount: "29.00", currencyCode: "USD" };
const line = {
  id: "gid://shopify/CartLine/1",
  quantity: 2,
  merchandise: { id: "gid://shopify/ProductVariant/1", title: "S", availableForSale: true, image: null, price: money, compareAtPrice: null, selectedOptions: [{ name: "Size", value: "S" }], product: { handle: "tee", title: "Tee", tags: [] } },
};
const cart = { id: "gid://shopify/Cart/1", checkoutUrl: "https://checkout.test/c/1", totalQuantity: 2, cost: { subtotalAmount: money, totalAmount: money }, lines: [line] };

test("a well-formed saved cart is restored as-is", () => {
  expect(parseStoredCart(JSON.stringify(cart))).toEqual(cart);
  expect(parseStoredCart(JSON.stringify({ ...cart, id: "demo-cart", checkoutUrl: "", lines: [] }))).toMatchObject({ id: "demo-cart" });
});

test("a missing, corrupt, or outdated saved cart starts fresh instead of breaking the page", () => {
  for (const stored of [null, "", "{", "null", "[]", JSON.stringify({ ...cart, lines: undefined }), JSON.stringify({ ...cart, cost: { subtotalAmount: "29.00" } }),
    JSON.stringify({ ...cart, lines: [{ ...line, merchandise: { ...line.merchandise, selectedOptions: undefined } }] }),
    JSON.stringify({ ...cart, lines: [{ ...line, merchandise: { ...line.merchandise, product: null } }] })]) {
    expect(parseStoredCart(stored)).toBeNull();
  }
});
