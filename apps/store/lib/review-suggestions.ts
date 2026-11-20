import type { CustomerAccountSession } from "./customer-account/storage";
import type { ReviewablePurchaseLine } from "./review-purchases";
import type { ProductCard } from "./shopify";

/** One shipped purchase the buyer hasn't reviewed yet. Safe to show them; the line ID is opaque. */
export type ReviewSuggestion = {
  lineId: string;
  /** The product's Shopify GID, as the review form submits it. */
  productId: string;
  productTitle: string;
  /** Order and variant, e.g. "Order #1001 · Black / M". */
  label: string;
  href: string;
  image: ProductCard["image"];
};

export type ReviewSuggestions = {
  buyer: { firstName: string | null; lastName: string | null };
  items: ReviewSuggestion[];
};

type RecentPurchases = { status: "found"; buyer: ReviewSuggestions["buyer"]; purchases: ReviewablePurchaseLine[] } | { status: "unavailable" };

/**
 * What a signed-in buyer could review next: lines from their newest orders
 * that pass the review rules, minus lines they've already reviewed and
 * products that are no longer on the storefront. Suggestions are a nicety, so
 * any failed lookup returns null and the page simply leaves them out; the
 * review form rechecks the purchase when it's submitted.
 */
export async function getReviewSuggestions({ session, findRecent, reviewedLines, productCards }: {
  session: CustomerAccountSession;
  findRecent: (session: CustomerAccountSession) => Promise<RecentPurchases>;
  reviewedLines: (subject: string, lineIds: string[]) => Promise<string[]>;
  productCards: (productIds: string[]) => Promise<Record<string, ProductCard>>;
}): Promise<ReviewSuggestions | null> {
  const recent = await findRecent(session).catch((): RecentPurchases => ({ status: "unavailable" }));
  if (recent.status !== "found") return null;
  if (!recent.purchases.length) return { buyer: recent.buyer, items: [] };
  const reviewed = await reviewedLines(session.subject, recent.purchases.map((purchase) => purchase.lineId)).catch(() => null);
  if (!reviewed) return null;
  const open = recent.purchases.filter((purchase) => !reviewed.includes(purchase.lineId));
  if (!open.length) return { buyer: recent.buyer, items: [] };
  const cards = await productCards(open.map((purchase) => purchase.productId)).catch(() => null);
  if (!cards) return null;
  return {
    buyer: recent.buyer,
    items: open.flatMap((purchase) => {
      const card = cards[purchase.productId];
      return card ? [{
        lineId: purchase.lineId, productId: `gid://shopify/Product/${purchase.productId}`, productTitle: card.title,
        label: purchase.label, href: `/products/${card.handle}#reviews`, image: card.image,
      }] : [];
    }),
  };
}
