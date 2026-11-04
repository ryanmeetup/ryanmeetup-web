"use client";

import { useId } from "react";
import { DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItems } from "@ryanmeetup/ui";
import { FiCheck, FiChevronDown, FiLoader } from "react-icons/fi";
import { convertDisplayMoney, currencyNames, displayCurrencies, isDisplayCurrency } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/types";
import { useDisplayCurrency } from "./currency-provider";

export type PriceBadgeProps = {
  price: Money;
  compareAt?: Money | null;
  from?: boolean;
  size?: "sm" | "lg";
  className?: string;
  id?: string;
};

const sizeClasses = {
  sm: {
    currency: "px-2 py-1 text-[10px]",
    price: "px-3 pt-2 text-sm/none sm:text-base/none",
    bottom: "pb-2",
    saleGap: "pb-1.5",
    original: "px-3 pb-2 text-[10px]/none sm:text-xs/none",
  },
  lg: {
    currency: "px-3 py-1 text-xs",
    price: "px-4 pt-3 text-3xl/none",
    bottom: "pb-3",
    saleGap: "pb-2",
    original: "px-4 pb-3 text-sm/none",
  },
};

export function PriceBadge({ price, compareAt, from = false, size = "sm", className = "", id }: PriceBadgeProps) {
  const classes = sizeClasses[size];
  const noteId = useId();
  const { currency, rates, loading, selectCurrency } = useDisplayCurrency();
  const displayed = convertDisplayMoney(price, currency, rates);
  const original = compareAt ? convertDisplayMoney(compareAt, currency, rates) : null;
  const converted = displayed.currencyCode !== price.currencyCode;
  const canConvert = isDisplayCurrency(price.currencyCode);
  const hint = `Choose a display currency. Converted prices are estimates; checkout is charged in ${price.currencyCode}.${rates ? ` Rates dated ${rates.date}.` : ""}`;

  return (
    <p id={id} aria-busy={loading || undefined} aria-describedby={converted ? noteId : undefined} className={`inline-grid max-w-full grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-sm bg-price font-mono font-medium leading-none tabular-nums text-white ring-1 ring-inset ring-white/30 ${className}`}>
      <span className={`col-start-1 row-start-1 whitespace-nowrap font-semibold tracking-tight ${classes.price} ${compareAt ? classes.saleGap : classes.bottom}`}>
        {from && <span className="mr-1.5 text-[0.65em] font-medium uppercase tracking-[0.12em]">From </span>}
        {converted && <span aria-hidden className="mr-1 text-[0.65em]">≈</span>}
        {formatMoney(displayed)}
      </span>{" "}
      {/* Menu renders no wrapper and its items portal out, so the badge stays a valid <p> outside the card link. */}
      <DropdownMenu>
        <DropdownMenuButton
          unstyled
          disabled={!canConvert}
          // Keep keyboard focus during loading; the menu items are disabled instead.
          aria-busy={loading || undefined}
          aria-label={loading ? "Loading currency conversions" : `Prices in ${displayed.currencyCode}. Choose a currency`}
          aria-describedby={converted ? noteId : undefined}
          title={canConvert ? hint : `Currency conversion is unavailable for ${price.currencyCode} prices.`}
          className={`pointer-events-auto col-start-2 row-span-2 row-start-1 inline-flex min-w-12 cursor-pointer items-center justify-center gap-1 self-stretch border-l border-white/25 bg-black/20 font-mono font-medium uppercase leading-none tracking-[0.12em] text-white transition hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-wait ${classes.currency}`}
        >
          {displayed.currencyCode}
          {loading
            ? <FiLoader aria-hidden className="h-3 w-3 animate-spin motion-reduce:animate-none" />
            : <FiChevronDown aria-hidden className="h-3 w-3" />}
        </DropdownMenuButton>
        <DropdownMenuItems align="end" aria-label="Display currency">
          {displayCurrencies.map((option) => (
            <DropdownMenuItem
              key={option}
              disabled={loading}
              aria-current={option === currency || undefined}
              onClick={() => void selectCurrency(option)}
            >
              <span className="w-10 font-mono text-xs font-semibold tracking-[0.12em]">{option}</span>
              <span className="flex-1">{currencyNames[option]}</span>
              {option === currency && <FiCheck aria-label="Selected" className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuItems>
      </DropdownMenu>
      {original && <s className={`col-start-1 row-start-2 whitespace-nowrap ${classes.original}`}><span className="sr-only">, originally </span>{formatMoney(original)}</s>}
      {converted && <span id={noteId} className={size === "lg" ? "col-span-2 row-start-3 px-4 pb-2 font-sans text-[10px] leading-snug" : "sr-only"}>Estimated · checkout in {price.currencyCode}</span>}
    </p>
  );
}
