"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, Pill } from "@ryanmeetup/ui";
import { FiCheck, FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import { formatMoney, getCompareAtPrice } from "@/lib/money";
import { getCartLineDisplay, getProductHref } from "@/lib/product-groups";
import { isDefaultTitleOption, withOneSize } from "@/lib/product-options";
import { withProductOrigin } from "@/lib/product-origin";
import type { CartLine, Money } from "@/lib/types";
import { useCart } from "./cart-provider";
import { SaleBadge } from "./sale-badge";

/** One cart line with its quantity controls, shared by the cart page and drawer. */
export function CartLineItem({ line, compact = false, highlighted = false, from }: { line: CartLine; compact?: boolean; highlighted?: boolean; from?: string }) {
  const { loading, removeItem, updateItem } = useCart();
  const { title, options } = getCartLineDisplay(line.merchandise.product, withOneSize(line.merchandise.selectedOptions.filter((option) => !isDefaultTitleOption(option))));
  const href = withProductOrigin(getProductHref(line.merchandise.product), from);
  const compareAtPrice = getCompareAtPrice(line.merchandise);
  const lineTotal = (money: Money) => formatMoney({ ...money, amount: (Number(money.amount) * line.quantity).toFixed(2) });

  return (
    <Card className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${compact ? "" : "sm:gap-x-6"} ${highlighted ? "ring-2 ring-emerald-500/70 dark:ring-emerald-400/70" : ""}`} size="sm">
      <Link href={href} className={`relative col-start-1 row-start-1 aspect-square w-24 self-start overflow-hidden sm:row-end-3 rounded-xl bg-black/5 dark:bg-white/5 ${compact ? "" : "sm:w-30"}`}>
        {line.merchandise.image ? <Image src={line.merchandise.image.url} alt={line.merchandise.image.altText || line.merchandise.product.title} fill sizes="120px" className="object-contain" /> : null}
      </Link>
      <div className="col-start-2 row-start-1 min-w-0 sm:col-end-4">
        {highlighted && <Pill variant="success" size="md" className="mb-2 whitespace-nowrap"><FiCheck aria-hidden /> Just added</Pill>}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={href} className={`block font-cooper tracking-wide hover:underline ${compact ? "text-lg" : "text-lg sm:text-xl"}`}>{title}</Link>
            {options.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-black/70 dark:text-white/70">{options.map((option) => <li key={option.name}>{option.name}: {option.value}</li>)}</ul>}
          </div>
          <div className="shrink-0 text-right">
            {compareAtPrice && <SaleBadge className="mb-1.5" />}
            <span className="block text-sm font-semibold">{lineTotal(line.merchandise.price)}</span>
            {compareAtPrice && <s className="mt-0.5 block text-xs text-black/70 dark:text-white/70"><span className="sr-only">Originally </span>{lineTotal(compareAtPrice)}</s>}
            {line.quantity > 1 && <span className="mt-1 block text-xs text-black/70 dark:text-white/70">{formatMoney(line.merchandise.price)} each</span>}
          </div>
        </div>
      </div>
      {/* Below sm the text column is too narrow for quantity and Remove on one row, so Remove sits under the photo; DOM order keeps quantity first for keyboard users. */}
      <div className="col-start-2 row-start-2 flex items-center gap-2">
        <button type="button" disabled={loading || line.quantity <= 1} onClick={() => updateItem(line.id, line.quantity - 1)} aria-label={`Decrease ${line.merchandise.product.title} quantity`} className="quantity-button"><FiMinus aria-hidden /></button>
        <span className="min-w-8 text-center text-sm font-semibold" aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
        <button type="button" disabled={loading} onClick={() => updateItem(line.id, line.quantity + 1)} aria-label={`Increase ${line.merchandise.product.title} quantity`} className="quantity-button"><FiPlus aria-hidden /></button>
      </div>
      <button type="button" disabled={loading} onClick={() => removeItem(line.id)} className="col-start-1 row-start-2 inline-flex w-full items-center justify-center gap-2 self-center rounded-lg sm:col-start-3 sm:w-auto border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-500/60 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/30 dark:text-red-400 dark:hover:border-red-400/60 dark:hover:bg-red-950/40 dark:focus-visible:ring-red-400/30"><FiTrash2 aria-hidden /> Remove</button>
    </Card>
  );
}
