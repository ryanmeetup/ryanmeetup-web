// Customer-service helpers shared by the contact page (server) and its form (client).

import { validateEmail } from "@ryanmeetup/utils";

/** The contact topic for a broken or weird bit of the site rather than an order. */
export const SITE_BUG_TOPIC = "site-bug";

export type SupportPrefill = { order: string; email: string; topic: string; page: string };

type SupportQuery = Partial<Record<"order" | "email" | "topic" | "from", string | string[]>>;

/**
 * Reads `?order=` and `?email=` from a "Need help with this order?" link in a Shopify
 * notification, and `?topic=site-bug&from=/path` from a bug-report link. Anything
 * malformed is dropped rather than shown back to the customer.
 */
export function parseSupportPrefill(query: SupportQuery): SupportPrefill {
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const order = first(query.order).replace(/^#/, "");
  const email = first(query.email);
  const from = first(query.from);
  return {
    order: /^[A-Za-z0-9-]{1,32}$/.test(order) ? `#${order}` : "",
    email: validateEmail(email) ? email : "",
    topic: first(query.topic) === SITE_BUG_TOPIC ? SITE_BUG_TOPIC : "",
    // Only a path on this site, so the field never echoes someone else's URL.
    page: /^\/(?!\/)[^\s]{0,199}$/.test(from) ? from : "",
  };
}

/** The contact form opened on the bug topic, remembering the page the visitor was on. */
export function getBugReportHref(from?: string) {
  const params = new URLSearchParams({ topic: SITE_BUG_TOPIC });
  if (from && from !== "/contact") params.set("from", from);
  return `/contact?${params}`;
}

/** Shopify Admin's order list for this shop, or null when the domain isn't a myshopify one. Server only. */
export function getAdminOrdersUrl(domain = process.env.SHOPIFY_STORE_DOMAIN) {
  const handle = domain?.replace(/^https?:\/\//, "").match(/^([a-z0-9-]+)\.myshopify\.com\/?$/i)?.[1];
  return handle ? `https://admin.shopify.com/store/${handle}/orders` : null;
}

/** An Admin order search by order number, or by the customer's email when there isn't one. */
export function getAdminOrderSearchUrl(adminOrdersUrl: string, orderNumber: string, email: string) {
  const query = orderNumber.trim().replace(/^#/, "") || email.trim();
  return `${adminOrdersUrl}?query=${encodeURIComponent(query)}`;
}
