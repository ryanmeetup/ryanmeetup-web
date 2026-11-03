// A product page's breadcrumb names the page the shopper came from. Links carry it as
// `?from=<collection handle>` or `?from=cart`; without one the trail is Store › product.
export const cartOrigin = "cart";

/** Adds the origin to a product link, keeping any design or color already on it. */
export function withProductOrigin(href: string, from: string | undefined) {
  if (!from) return href;
  const [path, search = ""] = href.split("?");
  const query = new URLSearchParams(search);
  query.set("from", from);
  return `${path}?${query.toString()}`;
}
