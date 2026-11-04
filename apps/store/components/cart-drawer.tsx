"use client";

import { Button, Drawer, EmptyState, ErrorCallout, Pill, Text } from "@ryanmeetup/ui";
import { formatMoney } from "@/lib/money";
import { CartLineItem } from "./cart-line";
import { useCart } from "./cart-provider";
import { CheckoutButton } from "./checkout-button";
import { EmptyCartButton } from "./empty-cart-button";

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
          {itemCount > 0 && <Pill variant="neutral" className="![font-family:Arial,Helvetica,sans-serif] !tracking-[0.12em]">{itemCount} {itemCount === 1 ? "item" : "items"}</Pill>}
        </span>
      }
      description={justAdded ? "Excellent choice, Ryan." : undefined}
      footer={cart?.lines.length ? (
        <>
          <div className="flex justify-between"><Text>Subtotal</Text><strong>{formatMoney(cart.cost.subtotalAmount)}</strong></div>
          <Text className="mt-1 text-sm">Shipping and taxes are calculated at checkout.</Text>
          <Button className="mt-4" variant="secondary" size="md" fullWidth onClick={close}>Keep shopping</Button>
          <CheckoutButton className="mt-3" />
        </>
      ) : undefined}
    >
      {cart?.lines.length ? (
        <div className="space-y-4" aria-busy={loading}>
          {cart.lines.map((line) => <CartLineItem key={line.id} line={line} compact highlighted={line.merchandise.id === justAdded} />)}
          {error && <ErrorCallout>{error}</ErrorCallout>}
          <EmptyCartButton />
        </div>
      ) : (
        <EmptyState message="Your cart is remarkably Ryan-free." />
      )}
    </Drawer>
  );
}
