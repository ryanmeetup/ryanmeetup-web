// Policies written in Shopify Admin open with a "Last updated: <date>" paragraph.
// Pulling it out lets a summary show the date as metadata instead of reading it
// as the first words of the policy. A policy without that line is left as is.
export function splitPolicyLastUpdated(body: string): { lastUpdated: string | null; body: string } {
  const paragraph = body.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  const text = paragraph?.[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  const date = text?.match(/^last updated:?\s*(.+)$/i)?.[1];
  return paragraph && date ? { lastUpdated: date, body: body.slice(paragraph[0].length) } : { lastUpdated: null, body };
}

/** The `dateTime` for a `<time>` element, or undefined when Shopify's text isn't a date. */
export function toIsoDate(value: string) {
  const date = new Date(`${value} UTC`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}
