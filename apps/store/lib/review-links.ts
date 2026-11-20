/** A review has no stable readable identifier, so its public permalink uses its ID. */
export const reviewAnchorId = (reviewId: string) => `review-${reviewId}`;

export function reviewPermalink(productHref: string, reviewId: string) {
  return `${productHref.split("#")[0]}#${reviewAnchorId(reviewId)}`;
}

export function reviewIdFromHash(hash: string): string | null {
  return /^#review-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(hash)?.[1].toLowerCase() ?? null;
}
