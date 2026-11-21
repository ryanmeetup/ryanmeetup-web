"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { FiTag } from "react-icons/fi";
import { Banner, Button, Text } from "@ryanmeetup/ui";
import { formatMoney, getCartSavings } from "@/lib/money";
import { currentPromotion, describeTierProgress, describeTiers, isPromotionLive, type Promotion } from "@/lib/promotion";
import type { Money } from "@/lib/types";

const PromotionContext = createContext<Promotion | null>(null);

// Re-checks the clock each minute, so an open tab picks up the start and end of a sale.
function subscribe(listener: () => void) {
  const timer = window.setInterval(listener, 60_000);
  return () => window.clearInterval(timer);
}

/**
 * Shares whether the sale is running. The server's clock decides the first render so
 * the banner is in the page from the start; the browser's clock then takes over, which
 * also corrects a page cached from before the sale began or after it ended.
 */
export function PromotionProvider({ children, live: serverLive }: { children: React.ReactNode; live: boolean }) {
  const live = useSyncExternalStore(subscribe, () => isPromotionLive(currentPromotion, Date.now()), () => serverLive);
  return <PromotionContext.Provider value={live ? currentPromotion : null}>{children}</PromotionContext.Provider>;
}

/** The running sale, or null when there isn't one. */
export function usePromotion() {
  return useContext(PromotionContext);
}

export function PromotionBanner() {
  const promotion = usePromotion();
  if (!promotion) return null;
  return (
    <Banner
      variant="brand"
      className="!px-0"
      contentClassName="store-container"
      icon={<FiTag className="h-6 w-6 sm:h-8 sm:w-8" aria-hidden />}
      iconAlign="center"
      aria-label={`${promotion.name} sale`}
      title={`${promotion.name}: the more Ryan, the more you save.`}
      action={<Button.Link href="/collections/all" variant="secondary" size="sm" className="whitespace-nowrap">Shop all</Button.Link>}
    >
      {/* Phones get the offer and the deadline; the reassurance waits for the room to say it. */}
      <p className="font-normal">{describeTiers(promotion.tiers)} through {promotion.endsLabel}.<span className="hidden sm:inline"> Mix and match anything; the discount applies at checkout.</span></p>
    </Banner>
  );
}

/** A reminder beside a product's price. */
export function PromotionNote({ className }: { className?: string }) {
  const promotion = usePromotion();
  if (!promotion) return null;
  return (
    <Text className={`flex items-center gap-2 text-sm ${className ?? ""}`}>
      <FiTag aria-hidden className="shrink-0" />
      <span><strong className="font-semibold">{promotion.name}:</strong> {describeTiers(promotion.tiers)}.</span>
    </Text>
  );
}

/** Where the cart stands against the sale's tiers. */
export function PromotionProgress({ quantity, className }: { quantity: number; className?: string }) {
  const promotion = usePromotion();
  if (!promotion) return null;
  const top = promotion.tiers.at(-1)!.minQuantity;
  return (
    <div className={`rounded-lg border border-black/10 p-3 dark:border-white/10 ${className ?? ""}`}>
      <Text className="flex items-start gap-2 text-sm" aria-live="polite">
        <FiTag aria-hidden className="mt-0.5 shrink-0" />
        <span><strong className="font-semibold">{promotion.name}:</strong> {describeTierProgress(promotion.tiers, quantity)}</span>
      </Text>
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-indigo-400 transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(quantity / top, 1) * 100}%` }} />
      </div>
    </div>
  );
}

/** Shopify's own figure for the cart's order discounts, so the cart never promises a saving checkout won't honour. */
export function CartSavings({ cart, className }: { cart: { discountAllocations?: { discountedAmount: Money }[] }; className?: string }) {
  const savings = getCartSavings(cart);
  const promotion = usePromotion();
  if (!savings) return null;
  return (
    <div className={`flex justify-between ${className ?? ""}`}>
      <Text>{promotion ? `${promotion.name} savings` : "Discounts"}</Text>
      <strong className="text-emerald-700 dark:text-emerald-300">−{formatMoney(savings)}</strong>
    </div>
  );
}
