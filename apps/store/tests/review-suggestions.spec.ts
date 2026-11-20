import { expect, test } from "@playwright/test";
import type { CustomerAccountSession } from "../lib/customer-account/storage";
import type { ReviewablePurchaseLine } from "../lib/review-purchases";
import { getReviewSuggestions } from "../lib/review-suggestions";

const session = { sessionHash: "a".repeat(64), subject: "buyer", createdAt: 1, expiresAt: 2, accessExpiresAt: 2, revision: 0,
  tokens: { accessToken: "a", refreshToken: "r", idToken: "i" } } as CustomerAccountSession;
const buyer = { firstName: "Ryan", lastName: "Le" };
const line = (lineId: string, productId: string): ReviewablePurchaseLine => ({ orderId: "9000", lineId, productId, variantId: "200",
  productTitle: "Name Tag Shirt (as ordered)", variantTitle: "Black / M", label: `Order #1001 · Black / M` });
const card = (handle: string) => ({ handle, title: `${handle} (current title)`, image: { url: `https://cdn.shopify.com/${handle}.jpg`, altText: null } });
const suggestions = (purchases: ReviewablePurchaseLine[] | null, { reviewed = [] as string[] | null, cards = { 100: card("tee"), 101: card("hat") } as Record<string, ReturnType<typeof card>> | null } = {}) =>
  getReviewSuggestions({
    session,
    findRecent: async () => (purchases ? { status: "found", buyer, purchases } : { status: "unavailable" }),
    reviewedLines: async (subject, lineIds) => { expect(subject).toBe("buyer"); if (!reviewed) throw new Error("down"); return reviewed.filter((id) => lineIds.includes(id)); },
    productCards: async () => { if (!cards) throw new Error("down"); return cards; },
  });

test("suggests unreviewed purchases that are still on the storefront, newest order first", async () => {
  expect(await suggestions([line("1", "100"), line("2", "101"), line("3", "999")], { reviewed: ["2"] })).toEqual({
    buyer,
    items: [{ lineId: "1", productId: "gid://shopify/Product/100", productTitle: "tee (current title)", label: "Order #1001 · Black / M",
      href: "/products/tee#reviews", image: { url: "https://cdn.shopify.com/tee.jpg", altText: null } }],
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
});
