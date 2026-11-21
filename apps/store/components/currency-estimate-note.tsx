"use client";

import { FiGlobe } from "react-icons/fi";
import { convertDisplayMoney } from "@/lib/currency";
import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/types";
import { useDisplayCurrency } from "./currency-provider";

/** Shows the USD subtotal in the shopper's display currency, flagged as an estimate, where they commit to an order. */
export function CurrencyEstimateNote({ subtotal, className = "" }: { subtotal: Money; className?: string }) {
  const { currency, rates } = useDisplayCurrency();
  const estimate = convertDisplayMoney(subtotal, currency, rates);
  if (estimate.currencyCode === subtotal.currencyCode) return null;
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5 ${className}`}>
      <FiGlobe aria-hidden className="mt-0.5 shrink-0 text-base text-black/70 dark:text-white/70" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold text-black dark:text-white">
          <span>Approximately in {currency}</span>
          <span className="font-mono tabular-nums"><span aria-hidden>≈</span>{formatMoney(estimate)}</span>
        </p>
        <p className="mt-0.5 text-black/70 dark:text-white/70">An estimate. Checkout shows your exact price.</p>
      </div>
    </div>
  );
}
