/** A review has no stable readable identifier, so its public permalink uses its ID. */
export const reviewAnchorId = (reviewId: string) => `review-${reviewId}`;

export function reviewPermalink(productHref: string, reviewId: string) {
  return `${productHref.split("#")[0]}#${reviewAnchorId(reviewId)}`;
}

export function reviewIdFromHash(hash: string): string | null {
  return /^#review-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(hash)?.[1].toLowerCase() ?? null;
}

/**
 * `/products/[handle]/review`, the page a phone opens to write a review. `order`
 * names the purchase readably ("#100" travels as `100`); `from: "mine"` returns
 * the buyer to My reviews rather than the product page.
 */
export function reviewRouteHref(handle: string, { order, from }: { order?: string; from?: "mine" } = {}) {
  const query = new URLSearchParams();
  if (order) query.set("order", order.replace(/^#/, ""));
  if (from) query.set("from", from);
  const search = query.toString();
  return `/products/${encodeURIComponent(handle)}/review${search ? `?${search}` : ""}`;
}
