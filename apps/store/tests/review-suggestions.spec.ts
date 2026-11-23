import { expect, test } from "@playwright/test";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { RecentReviewablePurchase } from "../lib/customer-account/review-lookups";
import { getReviewSuggestions, variantOptions } from "../lib/review-suggestions";

const session = { sessionHash: "a".repeat(64), subject: "buyer", createdAt: 1, expiresAt: 2, accessExpiresAt: 2, revision: 0,
  tokens: { accessToken: "a", refreshToken: "r", idToken: "i" } } as CustomerAccountSession;
const buyer = { firstName: "Ryan", lastName: "Le" };
const line = (lineId: string, productId: string): RecentReviewablePurchase => ({ orderId: "9000", lineId, productId, variantId: "200",
  productTitle: "Name Tag Shirt (as ordered)", variantTitle: "Black / M", label: `Order #1001 · Black / M`,
  orderLabel: "#1001", quantity: 2, shippedAt: "2026-11-16T12:00:00.000Z" });
const card = (handle: string) => ({ handle, title: `${handle} (current title)`, image: { url: `https://cdn.shopify.com/${handle}.jpg`, altText: null }, options: ["Color", "Size"] });
const suggestions = (purchases: RecentReviewablePurchase[] | null, { reviewed = [] as string[] | null, dismissed = [] as string[] | null, cards = { 100: card("tee"), 101: card("hat") } as Record<string, ReturnType<typeof card>> | null } = {}) =>
  getReviewSuggestions({
    session, accountUrl: "https://shopify.com/123/account",
    findRecent: async () => (purchases ? { status: "found", buyer, purchases } : { status: "unavailable" }),
    reviewedLines: async (subject, lineIds) => { expect(subject).toBe("buyer"); if (!reviewed) throw new Error("down"); return reviewed.filter((id) => lineIds.includes(id)); },
    dismissedLines: async (subject, lineIds) => { expect(subject).toBe("buyer"); if (!dismissed) throw new Error("down"); return dismissed.filter((id) => lineIds.includes(id)); },
    productCards: async () => { if (!cards) throw new Error("down"); return cards; },
  });

test("suggests unreviewed purchases that are still on the storefront, newest order first", async () => {
  expect(await suggestions([line("1", "100"), line("2", "101"), line("3", "999")], { reviewed: ["2"] })).toEqual({
    buyer,
    dismissedLineIds: [],
    items: [{ lineId: "1", productId: "gid://shopify/Product/100", productTitle: "tee (current title)", label: "Order #1001 · Black / M",
      options: [{ name: "Color", value: "Black" }, { name: "Size", value: "M" }],
      orderLabel: "#1001", orderUrl: "https://shopify.com/123/account/orders/9000", quantity: 2, shippedAt: "2026-11-16T12:00:00.000Z",
      href: "/products/tee#reviews", reviewHref: "/products/tee/review?order=1001&from=mine", image: { url: "https://cdn.shopify.com/tee.jpg", altText: null } }],
  });
});

test("nothing bought, or everything reviewed, means no suggestions without asking further", async () => {
  expect(await suggestions([])).toEqual({ buyer, items: [] });
  expect(await suggestions([line("1", "100")], { reviewed: ["1"], cards: null })).toEqual({ buyer, items: [] });
});

test("any failed lookup leaves suggestions out instead of guessing", async () => {
  expect(await suggestions(null)).toBeNull();
  expect(await suggestions([line("1", "100")], { reviewed: null })).toBeNull();
  expect(await suggestions([line("1", "100")], { cards: null })).toBeNull();
  expect(await suggestions([line("1", "100")], { dismissed: null })).toBeNull();
});

test("dismissals stay tied to a purchase; repeat purchases remain ready and reviewed lines stay excluded", async () => {
  const result = await suggestions([line("1", "100"), line("2", "100"), line("3", "101")], { dismissed: ["1", "3"], reviewed: ["3"] });
  expect(result?.items.map((item) => item.lineId)).toEqual(["1", "2"]);
  expect(result?.dismissedLineIds).toEqual(["1"]);
});

test("variant values pair with option names only when Shopify's counts agree", () => {
  expect(variantOptions('2.25"', ["Size"])).toEqual([{ name: "Size", value: '2.25"' }]);
  expect(variantOptions("Black / M", ["Color", "Size"])).toEqual([{ name: "Color", value: "Black" }, { name: "Size", value: "M" }]);
  expect(variantOptions("Black / M", ["Size"])).toEqual([{ name: null, value: "Black / M" }]);
  expect(variantOptions(null, ["Size"])).toEqual([]);
});
