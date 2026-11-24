"use client";

import { Button, Drawer, ErrorCallout, Pill, Text } from "@ryanmeetup/ui";
import { formatMoney } from "@/lib/money";
import { CartLineItem } from "./cart-line";
import { CartNote } from "./cart-note";
import { useCart } from "./cart-provider";
import { CheckoutButton } from "./checkout-button";
import { CurrencyEstimateNote } from "./currency-estimate-note";
import { EmptyCartButton } from "./empty-cart-button";
import { EmptyCartPrompt } from "./empty-cart-prompt";
import { FinalSaleNote } from "./final-sale-note";
import { SupportLine } from "./support-note";
import { CartSavings, PromotionProgress } from "./promotion";

/** Slides in after an item is added, so shoppers see the cart without leaving the page. */
export function CartDrawer() {
  const { cart, drawerOpen, error, justAdded, loading, setDrawerOpen } = useCart();
  const close = () => setDrawerOpen(false);
  const itemCount = cart?.totalQuantity ?? 0;

  return (
    <Drawer
      open={drawerOpen}
      setIsOpen={setDrawerOpen}
      panelClassName="sm:max-w-lg"
      title={
        <span className="inline-flex flex-wrap items-center gap-3">
          {justAdded ? "Added to cart" : "Your cart"}
          {itemCount > 0 && <Pill variant="neutral" className="![font-family:Arial,Helvetica,sans-serif] !tracking-caps-tight">{itemCount} {itemCount === 1 ? "item" : "items"}</Pill>}
        </span>
      }
      description={justAdded ? "Excellent choice, Ryan." : undefined}
      headerActions={cart?.lines.length ? <EmptyCartButton iconOnly /> : undefined}
      footer={cart?.lines.length ? (
        <>
          {/* Phones keep only what it takes to check out, so the footer doesn't crowd out the cart it summarizes. */}
          <PromotionProgress quantity={itemCount} compact className="mb-3 sm:mb-4" />
          <div className="flex justify-between"><Text>Subtotal</Text><strong>{formatMoney(cart.cost.subtotalAmount)}</strong></div>
          <CartSavings cart={cart} className="mt-2" />
          <CurrencyEstimateNote subtotal={cart.cost.subtotalAmount} className="mt-3" />
          <Text className="mt-2 text-xs sm:mt-3 sm:text-sm">Shipping and taxes are calculated at checkout. <FinalSaleNote onNavigate={close} /></Text>
          {/* The header's close button already keeps shoppers shopping, so these wait for a wider screen. Breakpoints sit on wrappers because Button's base display wins over `hidden`. */}
          <Text className="mt-3 hidden text-sm sm:block"><SupportLine /></Text>
          <div className="mt-4 hidden sm:block">
            <Button variant="secondary" size="md" fullWidth onClick={close}>Keep shopping</Button>
          </div>
          <CheckoutButton placement="cart_drawer" className="mt-3" />
        </>
      ) : undefined}
    >
      {cart?.lines.length ? (
        <div data-analytics-placement="cart_drawer" className="space-y-4" aria-busy={loading}>
          {cart.lines.map((line) => <CartLineItem key={line.id} line={line} compact highlighted={line.merchandise.id === justAdded} />)}
          {error && <ErrorCallout>{error}</ErrorCallout>}
          {/* In the scrolling body, not the footer, so phones keep checkout in view. */}
          <CartNote compact className="pt-2" />
        </div>
      ) : (
        <EmptyCartPrompt onNavigate={close} />
      )}
    </Drawer>
  );
}
