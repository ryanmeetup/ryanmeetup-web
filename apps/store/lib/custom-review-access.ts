import type { ReviewNameStyle } from "@ryanmeetup/reviews";
import { getCustomerAccountSession } from "./customer-account/runtime";
import { numericProductId } from "./custom-reviews";
import { getReviewPreview } from "./review-preview";
import { reviewSignInUrl } from "./review-sign-in";
import { currentRequest } from "./request-from-headers";
import { getReviewBackend } from "./review-backend";
import { findReviewablePurchases } from "./review-purchases";
import type { ReviewBuyerSession, ReviewEligibility } from "./review-purchases";
import { findTestBuyerPurchases, loadTestBuyerSession } from "./review-test-buyer";

/** One purchased order line the buyer can review. The label is safe to show; the ID is opaque. */
export type ReviewablePurchase = { lineId: string; label: string };

/**
 * Where a buyer stands with custom reviews for one product. The composer
 * renders each state; only `ready` shows the form.
 */
export type CustomReviewAccess =
  | { status: "unavailable" }
  | { status: "signed-out"; signInUrl: string }
  | { status: "no-purchase" }
  /** Bought, but in a lasting state (refunded, edited, unverifiable) the store has to look at. */
  | { status: "needs-help" }
  | { status: "reviewed" }
  | {
      status: "ready";
      buyer: { firstName: string | null; lastName: string | null };
      purchases: ReviewablePurchase[];
      defaultNameStyle: ReviewNameStyle;
      /** The localhost test buyer: its reviews are saved for real, without Shopify sign-in. */
      testBuyer: boolean;
    };

/**
 * The composer state for one product in custom mode, from the buyer's session
 * and their Shopify purchases. Without configured sign-in it is unavailable,
 * so collection stays closed.
 */
export async function getCustomReviewAccess<Session extends { subject: string }>({ productId, productPath, loadSession, findPurchases, reviewedLines, testBuyer = false }: {
  productId: string;
  productPath: string;
  loadSession: () => Promise<ReviewBuyerSession<Session>>;
  findPurchases: (session: Session, productId: string) => Promise<ReviewEligibility>;
  reviewedLines: (subject: string, lineIds: string[]) => Promise<string[]>;
  testBuyer?: boolean;
}): Promise<CustomReviewAccess> {
  const id = numericProductId(productId);
  if (!id) return { status: "unavailable" };
  const session = await loadSession().catch((): ReviewBuyerSession<Session> => ({ status: "unavailable" }));
  if (session.status === "unavailable") return { status: "unavailable" };
  if (session.status === "sign_in_required") return { status: "signed-out", signInUrl: reviewSignInUrl(`${productPath}#reviews`) };
  const eligibility = await findPurchases(session.session, id).catch(() => ({ status: "unavailable" as const }));
  if (eligibility.status === "unavailable") return { status: "unavailable" };
  if (eligibility.status === "none") return { status: eligibility.reason === "needs_help" ? "needs-help" : "no-purchase" };
  if (!eligibility.purchases.length) return { status: "no-purchase" };
  const lines = await reviewedLines(session.session.subject, eligibility.purchases.map((purchase) => purchase.lineId)).catch(() => null);
  if (!lines) return { status: "unavailable" };
  // A withdrawn review can be resubmitted on the same line; anything else counts as reviewed.
  const reviewed = new Set(lines);
  const open = eligibility.purchases.filter((purchase) => !reviewed.has(purchase.lineId));
  if (!open.length) return { status: "reviewed" };
  return {
    status: "ready",
    buyer: eligibility.buyer,
    purchases: open.map(({ lineId, label }) => ({ lineId, label })),
    defaultNameStyle: "first-initial",
    testBuyer,
  };
}

/**
 * Access for every product a page lists (a multi-design page lists several):
 * one session load for the page, then each product's own purchases.
 */
export async function getCustomReviewAccessByProduct(products: { id: string }[], productPath: string) {
  const backend = getReviewBackend();
  const reviewedLines = (subject: string, lineIds: string[]) => backend
    ? backend({ operation: "reviews.reviewedLines", subject, lineIds }) : Promise.reject(new Error("unavailable"));
  if ((await getReviewPreview())?.choice === "custom-test") {
    const entries = await Promise.all(products.map(async (item) => [item.id, await getCustomReviewAccess({
      productId: item.id, productPath, loadSession: loadTestBuyerSession, findPurchases: findTestBuyerPurchases, reviewedLines, testBuyer: true,
    })] as const));
    return Object.fromEntries(entries) as Record<string, CustomReviewAccess>;
  }
  const request = await currentRequest(productPath);
  let session: ReturnType<typeof getCustomerAccountSession> | undefined;
  const loadSession = () => (session ??= getCustomerAccountSession(request));
  const entries = await Promise.all(products.map(async (item) =>
    [item.id, await getCustomReviewAccess({ productId: item.id, productPath, loadSession, findPurchases: findReviewablePurchases, reviewedLines })] as const));
  return Object.fromEntries(entries) as Record<string, CustomReviewAccess>;
}
