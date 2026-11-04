"use client";

import { Card, ErrorCallout, Heading, Kicker, Text } from "@ryanmeetup/ui";
import { formatMoney } from "@/lib/money";
import { cartOrigin } from "@/lib/product-origin";
import { CartLineItem } from "./cart-line";
import { useCart } from "./cart-provider";
import { CheckoutButton } from "./checkout-button";
import { EmptyCartButton } from "./empty-cart-button";
import { EmptyCartPrompt } from "./empty-cart-prompt";

export function CartPage() {
  const { cart, error, loading } = useCart();

  if (!cart?.lines.length) {
    return (
      <main className="store-container min-h-[62vh] py-16 sm:py-24">
        <EmptyCartPrompt className="mx-auto max-w-xl" />
      </main>
    );
  }

  return (
    <main className="store-container py-12 sm:py-16">
      <Kicker>Current provisions</Kicker>
      <Heading size="h1" className="mt-2 text-4xl sm:text-5xl">Your cart</Heading>
      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4" aria-busy={loading}>
          {cart.lines.map((line) => <CartLineItem key={line.id} line={line} from={cartOrigin} />)}
          {error && <ErrorCallout>{error}</ErrorCallout>}
          <EmptyCartButton />
        </div>
        <Card size="lg" className="h-fit xl:sticky xl:top-28">
          <Heading size="h2" className="text-2xl">Order summary</Heading>
          <div className="mt-6 flex justify-between border-b border-black/10 pb-5 dark:border-white/10"><Text>Subtotal</Text><strong>{formatMoney(cart.cost.subtotalAmount)}</strong></div>
          <Text className="mt-4 text-sm">Shipping, discounts, and taxes are calculated securely at checkout.</Text>
          <CheckoutButton className="mt-6" />
        </Card>
      </div>
    </main>
  );
}
