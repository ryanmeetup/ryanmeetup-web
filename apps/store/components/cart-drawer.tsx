"use client";

import { Button, Drawer, EmptyState, ErrorCallout, Text } from "@ryanmeetup/ui";
import { formatMoney } from "@/lib/money";
import { CartLineItem } from "./cart-line";
import { useCart } from "./cart-provider";
import { CheckoutButton } from "./checkout-button";

/** Slides in after an item is added, so shoppers see the cart without leaving the page. */
export function CartDrawer() {
  const { cart, drawerOpen, error, justAdded, loading, setDrawerOpen } = useCart();
  const close = () => setDrawerOpen(false);

  return (
    <Drawer
      open={drawerOpen}
      setIsOpen={setDrawerOpen}
      panelClassName="sm:max-w-lg"
      title={justAdded ? "Added to cart" : "Your cart"}
      description={justAdded ? "Excellent choice, Ryan." : undefined}
      footer={cart?.lines.length ? (
        <>
          <div className="flex justify-between"><Text>Subtotal</Text><strong>{formatMoney(cart.cost.subtotalAmount)}</strong></div>
          <Text className="mt-1 text-sm">Shipping and taxes are calculated at checkout.</Text>
          <CheckoutButton className="mt-4" />
          <Button className="mt-3" variant="secondary" size="md" fullWidth onClick={close}>Keep shopping</Button>
        </>
      ) : undefined}
    >
      {cart?.lines.length ? (
        <div className="space-y-4" aria-busy={loading}>
          {cart.lines.map((line) => <CartLineItem key={line.id} line={line} compact highlighted={line.merchandise.id === justAdded} />)}
          {error && <ErrorCallout>{error}</ErrorCallout>}
        </div>
      ) : (
        <EmptyState message="Your cart is remarkably Ryan-free." />
      )}
    </Drawer>
  );
}
