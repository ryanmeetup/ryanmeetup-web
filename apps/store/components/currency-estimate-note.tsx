"use client";

import { Text } from "@ryanmeetup/ui";
import { useDisplayCurrency } from "./currency-provider";

/** Explains, where shoppers commit, that converted badge prices were approximations and the cart stays in USD. */
export function CurrencyEstimateNote({ className = "" }: { className?: string }) {
  const { currency } = useDisplayCurrency();
  if (currency === "USD") return null;
  return (
    <Text className={`text-sm ${className}`}>
      <strong className="font-semibold text-black dark:text-white">{currency} prices are approximate.</strong>{" "}
      Your cart totals are in USD, and checkout shows the exact price in your local currency, which can differ slightly from the ≈ estimates.
    </Text>
  );
}
