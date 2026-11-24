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
      {/* Shopify's hosted checkout is another origin, so this is a full page load, not a client navigation. */}
      <Button.Link href={cart.checkoutUrl} size="lg" fullWidth rightIcon={<FiArrowRight aria-hidden />} data-analytics-ignore aria-describedby={assuranceId}
        onClick={() => trackStoreEvent("checkout_clicked", { placement, subtotal: `${cart.cost.subtotalAmount.currencyCode} ${cart.cost.subtotalAmount.amount}` })}>
        Checkout
      </Button.Link>
      <p id={assuranceId} className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-caps-tight text-black/70 dark:text-white/70">
        <FiLock aria-hidden /> Secure checkout by Shopify
      </p>
    </div>
  );
}
