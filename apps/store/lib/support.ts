// Customer-service helpers shared by the contact page (server) and its form (client).

export type SupportPrefill = { order: string; email: string };

/**
 * Reads `?order=` and `?email=` from a "Need help with this order?" link in a Shopify
 * notification. Anything malformed is dropped rather than shown back to the customer.
 */
export function parseSupportPrefill(query: { order?: string | string[]; email?: string | string[] }): SupportPrefill {
  const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const order = first(query.order).replace(/^#/, "");
  const email = first(query.email);
  return {
    order: /^[A-Za-z0-9-]{1,32}$/.test(order) ? `#${order}` : "",
    email: email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
  };
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
