"use client";

import { useId } from "react";
import { DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItems, Tooltip } from "@ryanmeetup/ui";
import { FiCheck, FiChevronDown, FiInfo, FiLoader } from "react-icons/fi";
import { convertDisplayMoney, currencyNames, displayCurrencies, isDisplayCurrency } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import { applyPercentOff, getSitewidePercentOff } from "@/lib/promotion";
import type { Money } from "@/lib/types";
import { useDisplayCurrency } from "./currency-provider";
import { usePromotion } from "./promotion";

export type PriceBadgeProps = {
  price: Money;
  compareAt?: Money | null;
  /** False for listings checkout won't discount, such as off-Shopify links. */
  promotable?: boolean;
  from?: boolean;
  size?: "sm" | "lg";
  className?: string;
  id?: string;
};

const sizeClasses = {
  // Cards sit two-up on phones, so the badge stays compact until there is room.
  sm: {
    // Phones drop the chevron; the code alone is still the menu button and keeps its name.
    currency: "px-1.5 py-1 text-[10px] sm:min-w-12 sm:px-2",
    chevron: "hidden sm:block",
    price: "px-2 pt-1.5 text-xs/none sm:px-3 sm:pt-2 sm:text-base/none",
    bottom: "pb-1.5 sm:pb-2",
    saleGap: "pb-1 sm:pb-1.5",
    original: "px-2 pb-1.5 text-[10px]/none sm:px-3 sm:pb-2 sm:text-xs/none",
    info: "ml-1 size-5 [&>svg]:size-3.5",
  },
  lg: {
    currency: "min-w-12 px-3 py-1 text-xs",
    chevron: "",
    price: "px-4 pt-3 text-3xl/none",
    bottom: "pb-3",
    saleGap: "pb-2",
    original: "px-4 pb-3 text-sm/none",
    info: "ml-2 size-6 [&>svg]:size-4",
  },
};

export function PriceBadge({ price: listPrice, compareAt: markedDownFrom, promotable = true, from = false, size = "sm", className = "", id }: PriceBadgeProps) {
  const classes = sizeClasses[size];
  // A sitewide sale shows what checkout will charge, striking through the price it comes off.
  const promotion = usePromotion();
  const percentOff = promotable ? getSitewidePercentOff(promotion) : null;
  const price = percentOff ? applyPercentOff(listPrice, percentOff) : listPrice;
  const compareAt = percentOff ? markedDownFrom ?? listPrice : markedDownFrom;
  const noteId = useId();
  const { currency, rates, loading, selectCurrency } = useDisplayCurrency();
  const displayed = convertDisplayMoney(price, currency, rates);
  const original = compareAt ? convertDisplayMoney(compareAt, currency, rates) : null;
  const converted = displayed.currencyCode !== price.currencyCode;
  const canConvert = isDisplayCurrency(price.currencyCode);
  const hint = `Choose a display currency. Converted prices are approximate; checkout shows the exact price in your local currency.${rates ? ` Rates dated ${rates.date}.` : ""}`;

  return (
    <p id={id} aria-busy={loading || undefined} aria-describedby={converted ? noteId : undefined} className={`inline-grid max-w-full grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-sm bg-price font-mono font-medium leading-none tabular-nums text-white ring-1 ring-inset ring-white/30 ${className}`}>
      <span className={`col-start-1 row-start-1 whitespace-nowrap font-semibold tracking-tight ${classes.price} ${compareAt ? classes.saleGap : classes.bottom}`}>
        {from && <span className="mr-1.5 text-[0.65em] font-medium uppercase tracking-caps-tight">From </span>}
        {converted && <span aria-hidden className="mr-0.5 font-bold">≈</span>}
        {formatMoney(displayed)}
        {converted && (
          <Tooltip content={<>Approximate conversion from {price.currencyCode}. Checkout shows your exact price in your local currency.</>} triggerClassName="align-middle">
            <button
              type="button"
              aria-label="About converted prices"
              className={`pointer-events-auto inline-flex cursor-help items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${classes.info}`}
            >
              <FiInfo aria-hidden />
            </button>
          </Tooltip>
        )}
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
          className={`pointer-events-auto col-start-2 row-span-2 row-start-1 inline-flex cursor-pointer items-center justify-center gap-1 self-stretch border-l border-white/25 bg-black/20 font-mono font-medium uppercase leading-none tracking-caps-tight text-white transition hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-wait ${classes.currency}`}
        >
          {displayed.currencyCode}
          {loading
            ? <FiLoader aria-hidden className="h-3 w-3 animate-spin motion-reduce:animate-none" />
            : <FiChevronDown aria-hidden className={`h-3 w-3 ${classes.chevron}`} />}
        </DropdownMenuButton>
        <DropdownMenuItems align="end" aria-label="Display currency">
          {displayCurrencies.map((option) => (
            <DropdownMenuItem
              key={option}
              disabled={loading}
              aria-current={option === currency || undefined}
              onClick={() => void selectCurrency(option)}
            >
              <span className="w-10 font-mono text-xs font-semibold tracking-caps-tight">{option}</span>
              <span className="flex-1">{currencyNames[option]}</span>
              {option === currency && <FiCheck aria-label="Selected" className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuItems>
      </DropdownMenu>
      {original && <s className={`col-start-1 row-start-2 whitespace-nowrap ${classes.original}`}><span className="sr-only">, originally </span>{formatMoney(original)}</s>}
      {converted && <span id={noteId} className="sr-only">Approximate conversion · exact price at checkout</span>}
    </p>
  );
}
