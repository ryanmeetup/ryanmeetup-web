import { expect, test } from "@playwright/test";
import { GET } from "../app/api/currency-rates/route";
import { convertDisplayMoney, displayCurrencies, parseCurrencyRates } from "../lib/currency";
import type { CurrencyRates } from "../lib/currency";
import { formatMoney } from "../lib/money";

const rates: CurrencyRates = { date: "2026-11-04", rates: { USD: 1, EUR: 0.9, GBP: 0.75, CAD: 1.4, AUD: 1.5 } };
const usd = (amount: string) => ({ amount, currencyCode: "USD" });
const originalFetch = globalThis.fetch;
const originalError = console.error;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalError;
});

test("display conversions recalculate both sale prices without changing Shopify money", () => {
  const price = Object.freeze(usd("26.00"));
  const original = Object.freeze(usd("32.00"));
  expect(formatMoney(convertDisplayMoney(price, "EUR", rates))).toBe("€23.40");
  expect(formatMoney(convertDisplayMoney(original, "EUR", rates))).toBe("€28.80");
  expect(formatMoney(convertDisplayMoney(price, "GBP", rates))).toBe("£19.50");
  expect(formatMoney(convertDisplayMoney(convertDisplayMoney(price, "EUR", rates), "USD", rates))).toBe("$26.00");
  expect(price).toEqual(usd("26.00"));
  expect(original).toEqual(usd("32.00"));
});

test("missing rates never relabel an unconverted amount", () => {
  expect(convertDisplayMoney(usd("26.00"), "EUR", null)).toEqual(usd("26.00"));
  const unsupported = { amount: "26.00", currencyCode: "CHF" };
  expect(convertDisplayMoney(unsupported, "EUR", rates)).toEqual(unsupported);
});

test("rate validation rejects partial, nonpositive, and non-USD-base rate sets", () => {
  expect(parseCurrencyRates(rates)).toEqual(rates);
  for (const invalid of [null, { ...rates, date: "today" }, { ...rates, rates: { USD: 1, EUR: 0.9 } },
    ...[0, -1, Infinity, "0.9"].map((EUR) => ({ ...rates, rates: { ...rates.rates, EUR } })),
    { ...rates, rates: { ...rates.rates, USD: 2 } }]) {
    expect(() => parseCurrencyRates(invalid)).toThrow();
  }
});

test("the rates route uses reference rates and reports the oldest observation", async () => {
  let requested = "";
  globalThis.fetch = async (input) => {
    requested = String(input);
    return Response.json(displayCurrencies.filter((quote) => quote !== "USD").map((quote) => ({
      date: quote === "CAD" ? "2026-11-03" : rates.date,
      base: "USD", quote, rate: rates.rates[quote],
    })));
  };
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ...rates, date: "2026-11-03" });
  expect(new URL(requested).hostname).toBe("api.frankfurter.dev");
  expect(new URL(requested).searchParams.get("base")).toBe("USD");
});

test("the rates route fails cleanly rather than supplying made-up or partial conversions", async () => {
  console.error = () => undefined;
  for (const upstream of [new Response("Unavailable", { status: 503 }), Response.json([]),
    Response.json([{ date: rates.date, base: "USD", quote: "EUR", rate: 0 }])]) {
    globalThis.fetch = async () => upstream;
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Currency conversion is unavailable right now. Please try again." });
  }
});
