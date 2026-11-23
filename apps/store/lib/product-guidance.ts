import { htmlToText } from "./metadata";
import type { ShopPolicy } from "./types";

/** The plain text under one heading (plain words, no regex characters) of Shopify's shipping policy, or null when that section is missing or empty. */
function getShippingPolicySection(policies: ShopPolicy[], heading: string) {
  const policy = policies.find(({ handle }) => handle === "shipping-policy");
  if (!policy) return null;
  const pattern = new RegExp(`<h([1-6])\\b[^>]*>\\s*${heading}\\s*<\\/h\\1>([\\s\\S]*?)(?=<h[1-6]\\b|$)`, "i");
  const section = policy.body.match(pattern)?.[2];
  if (!section) return null;
  return htmlToText(section).replace(/\s+/g, " ").trim() || null;
}

/** Read the maintained policy section; never invent a delivery promise when it is missing. */
export function getProductionSummary(policies: ShopPolicy[]) {
  return getShippingPolicySection(policies, "Production time");
}

export type ShippingExpectation = { id: "production" | "countries" | "tracking"; title: string; detail: string };

/**
 * What a shopper can expect after ordering, in a few words each. Every figure comes from the
 * shipping policy or the countries checkout offers; a fact that is missing is left out rather
 * than guessed, except that every item is made to order.
 */
export function getShippingExpectations(policies: ShopPolicy[], countries: string[]): ShippingExpectation[] {
  const production = getProductionSummary(policies);
  const days = production?.match(/\b\d+(?:\s*[–-]\s*\d+)?\s+business days\b/i)?.[0].replace(/\s*[–-]\s*/, "–");
  const holidays = Boolean(production && /holiday/i.test(production));
  const items: ShippingExpectation[] = [{
    id: "production",
    title: "Made to order",
    detail: days ? `${days} to make, ${holidays ? "longer around the holidays" : "then it ships"}` : "Made for you, then it ships",
  }];
  const regions = [...new Set(countries)];
  if (regions.length > 1) {
    items.push({ id: "countries", title: `Ships to ${regions.length} countries and regions`, detail: "Shipping costs shown at checkout" });
  } else if (regions.length === 1) {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(regions[0]) ?? regions[0];
    items.push({ id: "countries", title: `Ships within ${name === "United States" ? "the United States" : name}`, detail: "Shipping costs shown at checkout" });
  }
  if (getShippingPolicySection(policies, "Tracking")) {
    items.push({ id: "tracking", title: "Tracking by email", detail: "Sent as soon as it ships" });
  }
  return items;
}

/** Printful's labelled size tables, including both unit systems, without unrelated product/legal copy. */
export function getSizeGuideHtml(descriptionHtml: string) {
  const heading = /<(p|h[1-6])\b[^>]*>\s*(?:<(?:strong|b|span)\b[^>]*>\s*)?Size guide\s*(?:<\/(?:strong|b|span)>\s*)?<\/\1>/i.exec(descriptionHtml);
  if (!heading) return null;
  const remaining = descriptionHtml.slice(heading.index + heading[0].length);
  const tables = remaining.match(/^\s*((?:(?:<div\b[^>]*>\s*<table\b[\s\S]*?<\/table>\s*<\/div>|<table\b[\s\S]*?<\/table>)\s*)+)/i)?.[1];
  return tables?.trim() || null;
}
