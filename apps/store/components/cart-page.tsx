"use client";

import Image from "next/image";
import Link from "next/link";
import { Button, Card, EmptyState, ErrorCallout, Heading, Kicker, Text } from "@ryanmeetup/ui";
import { FiArrowRight, FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import { formatMoney } from "@/lib/money";
import { getProductHref } from "@/lib/product-groups";
import { useCart } from "./cart-provider";

export function CartPage() {
  const { cart, commerceConfigured, error, loading, removeItem, updateItem } = useCart();

  if (!cart?.lines.length) {
    return (
      <main className="store-container min-h-[62vh] py-16 sm:py-24">
        <EmptyState className="mx-auto max-w-xl" message="Your cart is remarkably Ryan-free." />
        <div className="mx-auto mt-6 max-w-xs"><Button.Link href="/collections/all" size="md" fullWidth>Browse the goods</Button.Link></div>
      </main>
    );
  }

  return (
    <main className="store-container py-12 sm:py-16">
      <Kicker>Current provisions</Kicker>
      <Heading size="h1" className="mt-2 text-4xl sm:text-5xl">Your cart</Heading>
      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4" aria-busy={loading}>
          {cart.lines.map((line) => (
            <Card key={line.id} className="flex gap-4 sm:gap-6" size="sm">
              <Link href={getProductHref(line.merchandise.product)} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-black/5 sm:h-36 sm:w-30 dark:bg-white/5">
                {line.merchandise.image ? <Image src={line.merchandise.image.url} alt={line.merchandise.image.altText || line.merchandise.product.title} fill sizes="120px" className="object-contain" /> : null}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={getProductHref(line.merchandise.product)} className="font-cooper text-lg tracking-wide hover:underline sm:text-xl">{line.merchandise.product.title}</Link>
                    <p className="mt-1 text-xs text-black/55 dark:text-white/55">{line.merchandise.selectedOptions.map((option) => option.value).join(" / ")}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{formatMoney({ ...line.merchandise.price, amount: (Number(line.merchandise.price.amount) * line.quantity).toFixed(2) })}</span>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button type="button" disabled={loading || line.quantity <= 1} onClick={() => updateItem(line.id, line.quantity - 1)} aria-label={`Decrease ${line.merchandise.product.title} quantity`} className="quantity-button"><FiMinus aria-hidden /></button>
                  <span className="min-w-8 text-center text-sm font-semibold" aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
                  <button type="button" disabled={loading} onClick={() => updateItem(line.id, line.quantity + 1)} aria-label={`Increase ${line.merchandise.product.title} quantity`} className="quantity-button"><FiPlus aria-hidden /></button>
                  <button type="button" disabled={loading} onClick={() => removeItem(line.id)} className="ml-auto inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider text-black/55 hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"><FiTrash2 aria-hidden /> Remove</button>
                </div>
              </div>
            </Card>
          ))}
          {error && <ErrorCallout>{error}</ErrorCallout>}
        </div>
        <Card size="lg" className="h-fit xl:sticky xl:top-28">
          <Heading size="h2" className="text-2xl">Order summary</Heading>
          <div className="mt-6 flex justify-between border-b border-black/10 pb-5 dark:border-white/10"><Text>Subtotal</Text><strong>{formatMoney(cart.cost.subtotalAmount)}</strong></div>
          <Text className="mt-4 text-sm">Shipping, discounts, and taxes are calculated securely at checkout.</Text>
          {commerceConfigured ? (
            <a href={cart.checkoutUrl} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/60 bg-black px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white dark:text-black dark:hover:bg-white/90">Checkout <FiArrowRight aria-hidden /></a>
          ) : (
            <Button fullWidth size="md" className="mt-6" disabled>Connect Shopify to checkout</Button>
          )}
          <p className="mt-4 text-center text-[11px] uppercase tracking-[0.16em] text-black/50 dark:text-white/50">Secure checkout hosted by Shopify</p>
        </Card>
      </div>
    </main>
  );
}
