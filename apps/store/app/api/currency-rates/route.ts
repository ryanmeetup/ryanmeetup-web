import { isDisplayCurrency, parseCurrencyRates } from "@/lib/currency";

export async function GET() {
  try {
    const response = await fetch("https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,GBP,CAD,AUD", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Exchange-rate request failed (${response.status}).`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error("Invalid exchange-rate response.");
    const rates: Record<string, number> = { USD: 1 };
    const dates: string[] = [];
    for (const row of rows) {
      if (!row || row.base !== "USD" || !isDisplayCurrency(row.quote) || row.quote === "USD" || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        throw new Error("Invalid exchange-rate response.");
      }
      rates[row.quote] = row.rate;
      dates.push(row.date);
    }
    // Providers can publish on different days; report the oldest observation used.
    const data = parseCurrencyRates({ date: dates.sort()[0], rates });
    return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    console.error("Could not load currency conversion rates.", error);
    return Response.json({ error: "Currency conversion is unavailable right now. Please try again." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
