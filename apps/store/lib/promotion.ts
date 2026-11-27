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
  /** Swap the home hero for the sale's own takeover while it runs. Big sales only. */
  takeover?: boolean;
  /** Part of `name` set in name-tag red in the takeover headline, such as "RY". */
  accent?: string;
};

// Mirrors the "Black RYDay: 10% off everything", "Black RYDay: 3+ items, 15% off" and
// "Black RYDay: 5+ items, 20% off" automatic discounts. They don't combine, so Shopify applies
// the biggest one a cart qualifies for (started early on Nov 21, extended from Nov 30 to Dec 2; end time in America/New_York).
export const currentPromotion: Promotion | null = {
  name: "Black RYDay",
  startsAt: "2026-11-21T12:32:24-05:00",
  endsAt: "2026-12-02T23:59:59-05:00",
  endsLabel: "Wednesday, Dec 2",
  tiers: [
    { minQuantity: 1, percentOff: 10 },
    { minQuantity: 3, percentOff: 15 },
    { minQuantity: 5, percentOff: 20 },
  ],
  takeover: true,
  accent: "RY",
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

/** "off everything" or "off 3+ items": what one tier's percentage applies to. */
export function describeTierScope({ minQuantity }: PromotionTier) {
  return minQuantity <= 1 ? "off everything" : `off ${minQuantity}+ items`;
}

/** "10% off everything, 15% off 3+ items, 20% off 5+ items" */
export function describeTiers(tiers: PromotionTier[]) {
  return tiers
    .map((tier) => `${tier.percentOff}% ${describeTierScope(tier)}`)
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

// Sale dates are announced in the store's own time zone, so "tonight" means midnight Eastern.
const storeDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
const dayNumber = (time: number) => Date.parse(`${storeDay.format(time)}T00:00:00Z`) / 86_400_000;

/**
 * How close the sale's last day is, in calendar days in the store's time zone, or null while
 * it is further off than three days (or over). Real deadlines only: this is the sale's own end.
 */
export function describeSaleDeadline(promotion: Promotion | null, now: number) {
  if (!isPromotionLive(promotion, now)) return null;
  const days = dayNumber(Date.parse(promotion.endsAt)) - dayNumber(now);
  if (days <= 0) return "Ends tonight";
  if (days === 1) return "Ends tomorrow";
  if (days === 2) return "Last 3 days";
  return null;
}
