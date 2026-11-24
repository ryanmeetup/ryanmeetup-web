import { expect, test } from "@playwright/test";
import { applyListingHighlights, describeListingMilestone, pickListingHighlight, rankBestSellers, roundMilestone, type ProductActivity } from "../lib/listing-highlights";
import type { ProductListing } from "../lib/types";

const now = Date.parse("2026-11-24T12:00:00-05:00");
const quiet: ProductActivity = { sold30: 0, sold7: 0, soldPrior7: 0, soldInSale: 0, carts24h: 0, carts7: 0 };
const listing = (id: number, extra: Partial<ProductListing> = {}) => ({
  id: `gid://shopify/Product/${id}`, handle: `p${id}`, title: `P${id}`, availableForSale: true, createdAt: "2026-10-22T10:00:00Z", ...extra,
}) as ProductListing;

test("milestones round down to a step and stay hidden below ten", () => {
  expect(roundMilestone(9)).toBeNull();
  expect(roundMilestone(10)).toBe(10);
  expect(roundMilestone(49)).toBe(25);
  expect(roundMilestone(5000)).toBe(1000);
});

test("best sellers are the top five with at least five units", () => {
  const activity = Object.fromEntries([3, 9, 8, 7, 6, 5, 20].map((sold30, index) => [String(index + 1), { ...quiet, sold30 }]));
  expect([...rankBestSellers(activity)].sort()).toEqual(["2", "3", "4", "5", "7"]);
});

test("a listing earns its strongest label, and only from real signals", () => {
  const none = new Set<string>();
  expect(pickListingHighlight(listing(1), null, none, now)).toBeNull();
  expect(pickListingHighlight(listing(1), null, new Set(["1"]), now)).toBe("best-seller");
  expect(pickListingHighlight(listing(1), { 1: { ...quiet, sold7: 4, soldPrior7: 2 } }, none, now)).toBe("trending");
  expect(pickListingHighlight(listing(1), { 1: { ...quiet, sold7: 4, soldPrior7: 3 } }, none, now)).toBeNull();
  expect(pickListingHighlight(listing(1), { 1: { ...quiet, carts24h: 5 } }, none, now)).toBe("hot");
  expect(pickListingHighlight(listing(1, { rating: { average: 4.8, count: 5 } }), null, none, now)).toBe("top-rated");
  expect(pickListingHighlight(listing(1, { rating: { average: 4.7, count: 50 } }), null, none, now)).toBeNull();
  // Too few reviews to judge, however high.
  expect(pickListingHighlight(listing(1, { rating: { average: 5, count: 4 } }), null, none, now)).toBeNull();
  // The launch catalog isn't "new"; a later drop is, for 30 days.
  expect(pickListingHighlight(listing(1, { createdAt: "2026-11-13T12:00:00Z" }), null, none, now)).toBeNull();
  expect(pickListingHighlight(listing(1, { createdAt: "2026-11-20T12:00:00Z" }), null, none, now)).toBe("new");
  expect(pickListingHighlight(listing(1, { createdAt: "2026-11-20T12:00:00Z" }), null, none, Date.parse("2026-12-21T12:00:00Z"))).toBeNull();
  // Nothing hypes what can't be bought here.
  expect(pickListingHighlight(listing(1, { availableForSale: false }), null, new Set(["1"]), now)).toBeNull();
  expect(pickListingHighlight(listing(1, { externalUrl: "https://example.com" }), null, new Set(["1"]), now)).toBeNull();
});

test("a design group pools its designs' activity", () => {
  const group = listing(1, { designs: [{ label: "A", value: "a", product: listing(2) }, { label: "B", value: "b", product: listing(3) }] });
  const activity = { 2: { ...quiet, carts24h: 3 }, 3: { ...quiet, carts24h: 2 } };
  expect(pickListingHighlight(group, activity, new Set(), now)).toBe("hot");
});

test("highlights reach products, sections and leftovers, sharing one object per listing", () => {
  const shared = listing(1, { rating: { average: 5, count: 9 } });
  const result = applyListingHighlights({ products: [shared, listing(2)], sections: [{ collection: { handle: "c", title: "C", id: "c", description: "", image: null }, products: [shared], total: 1 }], more: [] }, null, now);
  expect(result.products.map((item) => item.highlight)).toEqual(["top-rated", undefined]);
  expect(result.sections?.[0].products[0]).toBe(result.products[0]);
});

test("the milestone prefers the running sale, then the month, then carts", () => {
  expect(describeListingMilestone(null, "Black RYDay")).toBeNull();
  expect(describeListingMilestone({ ...quiet, soldInSale: 27, sold30: 60 }, "Black RYDay")).toBe("25+ sold during Black RYDay");
  expect(describeListingMilestone({ ...quiet, soldInSale: 27, sold30: 60 }, null)).toBe("50+ sold this month");
  expect(describeListingMilestone({ ...quiet, soldInSale: 4, sold30: 9, carts7: 12 }, "Black RYDay")).toBe("In 10+ carts this week");
  expect(describeListingMilestone({ ...quiet, sold30: 9, carts7: 9 }, null)).toBeNull();
});
