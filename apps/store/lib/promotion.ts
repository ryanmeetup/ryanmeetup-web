// The storefront's copy of a quantity-tiered sale, so the banner, product pages and cart
// can advertise it. Shopify applies the discount itself at checkout, from automatic
// discounts in Shopify Admin → Discounts; this file only describes them. Keep the tiers
// and dates here identical to those discounts, and set `currentPromotion` to null once a
// sale is over and its discounts are gone.

import type { Money } from "./types";

export type PromotionTier = { minQuantity: number; percentOff: number };

export type Promotion = {
  name: string;
  startsAt: string;
  endsAt: string;
  /** The last day shoppers read, in the store's own time zone. */
  endsLabel: string;
  /** Ascending by `minQuantity`. */
  tiers: PromotionTier[];
};

// Mirrors the "Black RYDay: 10% off everything", "Black RYDay: 3+ items, 15% off" and
// "Black RYDay: 5+ items, 20% off" automatic discounts. They don't combine, so Shopify applies
// the biggest one a cart qualifies for (started early on Nov 21; end time in America/New_York).
export const currentPromotion: Promotion | null = {
  name: "Black RYDay",
  startsAt: "2026-11-21T12:32:24-05:00",
  endsAt: "2026-11-30T23:59:59-05:00",
  endsLabel: "Monday, Nov 30",
  tiers: [
    { minQuantity: 1, percentOff: 10 },
    { minQuantity: 3, percentOff: 15 },
    { minQuantity: 5, percentOff: 20 },
  ],
};

/** The discount every item gets, from a tier with no real minimum, or null when the sale is tiered only. */
export function getSitewidePercentOff(promotion: Promotion | null) {
  return promotion?.tiers.find((tier) => tier.minQuantity <= 1)?.percentOff ?? null;
}

/** `money` with `percentOff` taken off, to the cent. */
export function applyPercentOff(money: Money, percentOff: number): Money {
  const cents = Math.round(Number(money.amount) * (100 - percentOff));
  return { ...money, amount: (cents / 100).toFixed(2) };
}

export function isPromotionLive(promotion: Promotion | null, now: number): promotion is Promotion {
  return Boolean(promotion) && now >= Date.parse(promotion!.startsAt) && now <= Date.parse(promotion!.endsAt);
}

/** "10% off everything, 15% off 3+ items, 20% off 5+ items" */
export function describeTiers(tiers: PromotionTier[]) {
  return tiers
    .map(({ minQuantity, percentOff }) => `${percentOff}% off ${minQuantity <= 1 ? "everything" : `${minQuantity}+ items`}`)
    .join(", ");
}

/** The tier a cart of `quantity` items earns, and the next one it could reach. */
export function getTierProgress(tiers: PromotionTier[], quantity: number) {
  const current = tiers.filter((tier) => quantity >= tier.minQuantity).at(-1) ?? null;
  const next = tiers.find((tier) => quantity < tier.minQuantity) ?? null;
  return { current, next, itemsToNext: next ? next.minQuantity - quantity : 0 };
}

/** A sentence telling the shopper where their cart stands. */
export function describeTierProgress(tiers: PromotionTier[], quantity: number) {
  const { current, next, itemsToNext } = getTierProgress(tiers, quantity);
  const more = `${itemsToNext} more ${itemsToNext === 1 ? "item" : "items"}`;
  if (!current && next) return `Add ${more} to get ${next.percentOff}% off your order.`;
  if (current && next) return `You’ve unlocked ${current.percentOff}% off. Add ${more} for ${next.percentOff}% off.`;
  if (current) return `You’ve unlocked ${current.percentOff}% off, the biggest Ryan discount there is.`;
  return "";
}
