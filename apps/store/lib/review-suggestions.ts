import type { CustomerAccountSession } from "./customer-account/storage";
import type { RecentReviewablePurchase } from "./customer-account/review-lookups";
import type { ProductCard } from "./shopify";

/** One shipped purchase the buyer hasn't reviewed yet. Safe to show them; the line ID is opaque. */
export type ReviewSuggestion = {
  lineId: string;
  /** The product's Shopify GID, as the review form submits it. */
  productId: string;
  productTitle: string;
  /** Order and variant in one line, for the review form's "Reviewing …". */
  label: string;
  /** One entry per variant option; `name` is null when Shopify's option names don't line up. */
  options: { name: string | null; value: string }[];
  orderLabel: string;
  /** The order on Shopify's customer account pages, when the store knows where they are. */
  orderUrl: string | null;
  quantity: number;
  shippedAt: string | null;
  href: string;
  image: ProductCard["image"];
};

/**
 * Shopify names a variant "Blue / M", listing values in the product's option
 * order. Pair them with the option names when the counts agree; otherwise
 * show the title as one unlabelled value rather than guess.
 */
export function variantOptions(variantTitle: string | null, optionNames: string[]): ReviewSuggestion["options"] {
  if (!variantTitle) return [];
  const values = variantTitle.split(" / ");
  return values.length === optionNames.length ? values.map((value, index) => ({ name: optionNames[index], value })) : [{ name: null, value: variantTitle }];
}

export type ReviewSuggestions = {
  buyer: { firstName: string | null; lastName: string | null };
  items: ReviewSuggestion[];
};

type RecentPurchases = { status: "found"; buyer: ReviewSuggestions["buyer"]; purchases: RecentReviewablePurchase[] } | { status: "unavailable" };

/**
 * What a signed-in buyer could review next: lines from their newest orders
 * that pass the review rules, minus lines they've already reviewed and
 * products that are no longer on the storefront. Suggestions are a nicety, so
 * any failed lookup returns null and the page simply leaves them out; the
 * review form rechecks the purchase when it's submitted.
 */
export async function getReviewSuggestions({ session, findRecent, reviewedLines, productCards, accountUrl = null }: {
  session: CustomerAccountSession;
  /** Shopify's customer account address; order links are built under it. */
  accountUrl?: string | null;
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
        label: purchase.label, options: variantOptions(purchase.variantTitle, card.options),
        orderLabel: purchase.orderLabel, quantity: purchase.quantity, shippedAt: purchase.shippedAt,
        orderUrl: accountUrl ? `${accountUrl.replace(/\/$/, "")}/orders/${purchase.orderId}` : null,
        href: `/products/${card.handle}#reviews`, image: card.image,
      }] : [];
    }),
  };
}
