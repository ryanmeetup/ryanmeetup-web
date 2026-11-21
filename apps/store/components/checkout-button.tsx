"use client";

import { useId } from "react";
import { Button } from "@ryanmeetup/ui";
import { FiArrowRight, FiLock } from "react-icons/fi";
import { trackStoreEvent } from "@/lib/analytics";
import { useCart } from "./cart-provider";

/** Shopify's hosted checkout, or a disabled stand-in while the store runs on demo data. */
export function CheckoutButton({ className = "", placement }: { className?: string; placement: "cart_drawer" | "cart_page" }) {
  const { cart, commerceConfigured } = useCart();
  const assuranceId = useId();

  if (!commerceConfigured || !cart) {
    return <Button fullWidth size="md" className={className} disabled>Connect Shopify to checkout</Button>;
  }
  return (
    <div className={className}>
      <a href={cart.checkoutUrl} data-analytics-ignore onClick={() => trackStoreEvent("checkout_clicked", { placement, subtotal: `${cart.cost.subtotalAmount.currencyCode} ${cart.cost.subtotalAmount.amount}` })} aria-describedby={assuranceId} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/60 bg-black px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-white/90">Checkout <FiArrowRight aria-hidden /></a>
      <p id={assuranceId} className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-caps-tight text-black/70 dark:text-white/70">
        <FiLock aria-hidden /> Secure checkout by Shopify
      </p>
    </div>
  );
}
