import { expect, test } from "@playwright/test";
import { getCartSavings } from "../lib/money";
import { applyPercentOff, describeSaleDeadline, describeTierProgress, describeTiers, getSitewidePercentOff, getTierProgress, isPromotionLive, type Promotion } from "../lib/promotion";

const tiers = [{ minQuantity: 3, percentOff: 10 }, { minQuantity: 5, percentOff: 15 }];
const promotion: Promotion = { name: "Sale", startsAt: "2026-11-27T00:00:00-05:00", endsAt: "2026-11-30T23:59:59-05:00", endsLabel: "Monday", tiers };

test("a sale runs only between its start and end", () => {
  expect(isPromotionLive(promotion, Date.parse("2026-11-26T23:59:59-05:00"))).toBe(false);
  expect(isPromotionLive(promotion, Date.parse("2026-11-27T00:00:00-05:00"))).toBe(true);
  expect(isPromotionLive(promotion, Date.parse("2026-11-30T23:59:59-05:00"))).toBe(true);
  expect(isPromotionLive(promotion, Date.parse("2026-12-01T00:00:00-05:00"))).toBe(false);
  expect(isPromotionLive(null, Date.parse("2026-11-28T12:00:00-05:00"))).toBe(false);
});

test("a cart earns the highest tier it reaches and is told the next", () => {
  expect(getTierProgress(tiers, 0)).toEqual({ current: null, next: tiers[0], itemsToNext: 3 });
  expect(getTierProgress(tiers, 4)).toEqual({ current: tiers[0], next: tiers[1], itemsToNext: 1 });
  expect(getTierProgress(tiers, 9)).toEqual({ current: tiers[1], next: null, itemsToNext: 0 });

  expect(describeTiers(tiers)).toBe("10% off 3+ items, 15% off 5+ items");
  expect(describeTierProgress(tiers, 2)).toBe("Add 1 more item to get 10% off your order.");
  expect(describeTierProgress(tiers, 3)).toBe("You’ve unlocked 10% off. Add 2 more items for 15% off.");
  expect(describeTierProgress(tiers, 5)).toBe("You’ve unlocked 15% off, the biggest Ryan discount there is.");

  const sitewide = [{ minQuantity: 1, percentOff: 10 }, ...tiers.map((tier) => ({ ...tier, percentOff: tier.percentOff + 5 }))];
  expect(describeTiers(sitewide)).toBe("10% off everything, 15% off 3+ items, 20% off 5+ items");
  expect(describeTierProgress(sitewide, 1)).toBe("You’ve unlocked 10% off. Add 2 more items for 15% off.");
});

test("cart savings add up Shopify's order discounts", () => {
  const usd = (amount: string) => ({ discountedAmount: { amount, currencyCode: "USD" } });
  expect(getCartSavings({})).toBeNull();
  expect(getCartSavings({ discountAllocations: [] })).toBeNull();
  expect(getCartSavings({ discountAllocations: [usd("4.50"), usd("1.25")] })).toEqual({ amount: "5.75", currencyCode: "USD" });
});

test("a sitewide tier discounts every item's shown price", () => {
  expect(getSitewidePercentOff(promotion)).toBeNull();
  expect(getSitewidePercentOff(null)).toBeNull();
  expect(getSitewidePercentOff({ ...promotion, tiers: [{ minQuantity: 1, percentOff: 10 }, ...tiers] })).toBe(10);

  expect(applyPercentOff({ amount: "35.00", currencyCode: "USD" }, 10)).toEqual({ amount: "31.50", currencyCode: "USD" });
  expect(applyPercentOff({ amount: "30.0", currencyCode: "USD" }, 10)).toEqual({ amount: "27.00", currencyCode: "USD" });
  expect(applyPercentOff({ amount: "32.99", currencyCode: "USD" }, 10)).toEqual({ amount: "29.69", currencyCode: "USD" });
});

test("the deadline counts down in the store's calendar days, and only near the end", () => {
  const at = (time: string) => describeSaleDeadline(promotion, Date.parse(time));
  expect(at("2026-11-27T09:00:00-05:00")).toBeNull();
  expect(at("2026-11-28T00:00:00-05:00")).toBe("Last 3 days");
  expect(at("2026-11-29T23:30:00-05:00")).toBe("Ends tomorrow");
  // 11:30 p.m. Eastern is already the next day in UTC; the store's day decides.
  expect(at("2026-11-30T00:00:00-05:00")).toBe("Ends tonight");
  expect(at("2026-11-30T23:59:00-05:00")).toBe("Ends tonight");
  expect(at("2026-12-01T00:00:00-05:00")).toBeNull();
  expect(describeSaleDeadline(null, Date.parse("2026-11-30T12:00:00-05:00"))).toBeNull();
});
