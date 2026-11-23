import { htmlToText } from "./metadata";
import type { ShopPolicy } from "./types";

/** Read the maintained policy section; never invent a delivery promise when it is missing. */
export function getProductionSummary(policies: ShopPolicy[]) {
  const policy = policies.find(({ handle }) => handle === "shipping-policy");
  if (!policy) return null;
  const section = policy.body.match(/<h([1-6])\b[^>]*>\s*Production time\s*<\/h\1>([\s\S]*?)(?=<h[1-6]\b|$)/i)?.[2];
  if (!section) return null;
  return htmlToText(section).replace(/\s+/g, " ").trim() || null;
}

/** Printful's labelled size tables, including both unit systems, without unrelated product/legal copy. */
export function getSizeGuideHtml(descriptionHtml: string) {
  const heading = /<(p|h[1-6])\b[^>]*>\s*(?:<(?:strong|b|span)\b[^>]*>\s*)?Size guide\s*(?:<\/(?:strong|b|span)>\s*)?<\/\1>/i.exec(descriptionHtml);
  if (!heading) return null;
  const remaining = descriptionHtml.slice(heading.index + heading[0].length);
  const tables = remaining.match(/^\s*((?:(?:<div\b[^>]*>\s*<table\b[\s\S]*?<\/table>\s*<\/div>|<table\b[\s\S]*?<\/table>)\s*)+)/i)?.[1];
  return tables?.trim() || null;
}
