import type { Money } from "./types";

export const displayCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
export type DisplayCurrency = typeof displayCurrencies[number];
export type CurrencyRates = {
  date: string;
  rates: Record<DisplayCurrency, number>;
};

export const currencyStorageKey = "ryan-store-currency";

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === "string" && displayCurrencies.some((currency) => currency === value);
}

export const currencyNames: Record<DisplayCurrency, string> = {
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
  CAD: "Canadian dollar",
  AUD: "Australian dollar",
};

/** Validate both the server response and a cached browser response before using any rate. */
export function parseCurrencyRates(value: unknown): CurrencyRates {
  if (!value || typeof value !== "object") throw new Error("Invalid exchange rates.");
  const { date, rates } = value as { date?: unknown; rates?: unknown };
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !rates || typeof rates !== "object") {
    throw new Error("Invalid exchange rates.");
  }
  const entries = rates as Record<string, unknown>;
  for (const currency of displayCurrencies) {
    if (typeof entries[currency] !== "number" || !Number.isFinite(entries[currency]) || entries[currency] <= 0) {
      throw new Error("Invalid exchange rates.");
    }
  }
  if (entries.USD !== 1) throw new Error("Exchange rates must use USD as their base.");
  return { date, rates: Object.fromEntries(displayCurrencies.map((currency) => [currency, entries[currency]])) as CurrencyRates["rates"] };
}

/** Display estimates only. Shopify's original amounts still supply cart and checkout. */
export function convertDisplayMoney(money: Money, currency: DisplayCurrency, rates: CurrencyRates | null): Money {
  if (money.currencyCode === currency || !rates || !isDisplayCurrency(money.currencyCode)) return money;
  return {
    amount: String(Number(money.amount) * rates.rates[currency] / rates.rates[money.currencyCode]),
    currencyCode: currency,
  };
}
