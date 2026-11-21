import type { ReviewNameStyle } from "@ryanmeetup/reviews";
import { getCustomerAccountSession } from "./customer-account/runtime";
import { numericProductId } from "./custom-reviews";
import { reviewSignInUrl } from "./review-sign-in";
import { currentRequest } from "./request-from-headers";
import { getReviewBackend } from "./review-backend";
import { findBuyerName, findReviewablePurchases } from "./review-purchases";
import type { CustomerSessionResult } from "./customer-account/session";
import type { CustomerAccountSession } from "./customer-account/storage";
import type { ReviewEligibilityLookup } from "./review-purchases";
import { reviewViewerKey } from "./review-viewer";
import { reviewPhotosEnabled } from "./review-photo-policy";

/**
 * One purchased order line the buyer can review. The label, order name and
 * variant are safe to show; the ID is opaque. The composer lays the order and
 * variant out as labelled rows when it has them, and falls back to the label.
 */
export type ReviewablePurchase = {
  lineId: string; label: string; orderLabel?: string;
  /** Shopify's "Blue / M"; the composer pairs it with the product's option names. */
  variantTitle?: string | null;
  /** Already-paired options, when the caller has them instead of a title. */
  options?: { name: string | null; value: string }[];
};

type BuyerName = { firstName: string | null; lastName: string | null };

/**
 * Where a buyer stands with custom reviews for one product. The composer
 * renders each state; only `ready` shows the form. A signed-in buyer with a
 * matching order reviews that order; anyone else signed in can still write
 * one review of the product, which shows without the Verified badge.
 */
export type CustomReviewAccess =
  | { status: "unavailable" }
  | { status: "signed-out"; signInUrl: string }
  | { status: "reviewed" }
  | {
      status: "ready";
      buyer: BuyerName;
      /** The buyer's unreviewed matching order lines; empty means a review without a matching order. */
      purchases: ReviewablePurchase[];
      defaultNameStyle: ReviewNameStyle;
      photos?: { productId: string; viewerKey: string };
    };

/**
 * The composer state for one product in custom mode, from the buyer's session
 * and their Shopify purchases. Without configured sign-in it is unavailable,
 * so collection stays closed. A Shopify or storage failure stays unavailable;
 * it never quietly turns a buyer's order into an unverified review.
 */
export async function getCustomReviewAccess({ productId, productPath, loadSession, findPurchases, findBuyerName, reviewedLines, reviewedProducts }: {
  productId: string;
  productPath: string;
  loadSession: () => Promise<CustomerSessionResult>;
  findPurchases: ReviewEligibilityLookup;
  findBuyerName: (session: CustomerAccountSession) => Promise<BuyerName | null>;
  reviewedLines: (subject: string, lineIds: string[]) => Promise<string[]>;
  reviewedProducts: (subject: string, productIds: string[]) => Promise<string[]>;
}): Promise<CustomReviewAccess> {
  const id = numericProductId(productId);
  if (!id) return { status: "unavailable" };
  const session = await loadSession().catch((): CustomerSessionResult => ({ status: "unavailable" }));
  if (session.status === "unavailable") return { status: "unavailable" };
  if (session.status === "sign_in_required") return { status: "signed-out", signInUrl: reviewSignInUrl(`${productPath}#reviews`) };
  const subject = session.session.subject;
  const eligibility = await findPurchases(session.session, id).catch(() => ({ status: "unavailable" as const }));
  if (eligibility.status === "unavailable") return { status: "unavailable" };

  if (eligibility.status === "eligible" && eligibility.purchases.length) {
    const lines = await reviewedLines(subject, eligibility.purchases.map((purchase) => purchase.lineId)).catch(() => null);
    if (!lines) return { status: "unavailable" };
    // A withdrawn review can be resubmitted on the same line; anything else counts as reviewed.
    const reviewed = new Set(lines);
    const open = eligibility.purchases.filter((purchase) => !reviewed.has(purchase.lineId));
    if (!open.length) return { status: "reviewed" };
    return { status: "ready", buyer: eligibility.buyer, purchases: open.map(({ lineId, label, orderLabel, variantTitle }) => ({ lineId, label, orderLabel, variantTitle })), defaultNameStyle: "first-initial" };
  }

  // No matching order (or one the store would have to check by hand): one unverified review per product.
  const [products, buyer] = await Promise.all([
    reviewedProducts(subject, [id]).catch(() => null),
    findBuyerName(session.session).catch(() => null),
  ]);
  if (!products || !buyer) return { status: "unavailable" };
  if (products.includes(id)) return { status: "reviewed" };
  return { status: "ready", buyer, purchases: [], defaultNameStyle: "first-initial" };
}

/**
 * Access for every product a page lists (a multi-design page lists several):
 * one session load for the page, then each product's own purchases.
 */
export async function getCustomReviewAccessByProduct(products: { id: string }[], productPath: string) {
  const backend = getReviewBackend();
  const reviewedLines = (subject: string, lineIds: string[]) => backend
    ? backend({ operation: "reviews.reviewedLines", subject, lineIds }) : Promise.reject(new Error("unavailable"));
  const reviewedProducts = (subject: string, productIds: string[]) => backend
    ? backend({ operation: "reviews.reviewedProducts", subject, productIds }) : Promise.reject(new Error("unavailable"));
  const request = await currentRequest(productPath);
  let session: Promise<CustomerSessionResult> | undefined;
  const loadSession = () => (session ??= getCustomerAccountSession(request));
  const entries = await Promise.all(products.map(async (item) => {
    const access = await getCustomReviewAccess({ productId: item.id, productPath, loadSession, findPurchases: findReviewablePurchases, findBuyerName, reviewedLines, reviewedProducts });
    if (access.status !== "ready" || !reviewPhotosEnabled()) return [item.id, access] as const;
    const current = await loadSession();
    return [item.id, current.status === "authenticated"
      ? { ...access, photos: { productId: numericProductId(item.id)!, viewerKey: reviewViewerKey(current.session) } } : access] as const;
  }));
  return Object.fromEntries(entries) as Record<string, CustomReviewAccess>;
}
