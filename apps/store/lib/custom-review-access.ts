import type { ReviewNameStyle } from "@ryanmeetup/reviews";
import type { CustomerSessionResult } from "./customer-account/session";
import { numericProductId } from "./custom-reviews";
import { getReviewPreview } from "./review-preview";
import type { ReviewEligibilityLookup } from "./review-purchases";

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
  | { status: "reviewed" }
  | {
      status: "ready";
      buyer: { firstName: string | null; lastName: string | null };
      purchases: ReviewablePurchase[];
      defaultNameStyle: ReviewNameStyle;
      /** A preview-only pretend buyer: the form checks the review but saves nothing. */
      sample: boolean;
    };

const sampleAccess: CustomReviewAccess = {
  status: "ready",
  buyer: { firstName: "Ryan", lastName: "Sample" },
  purchases: [{ lineId: "sample-line", label: "Sample order" }],
  defaultNameStyle: "first-initial",
  sample: true,
};

/** Sign-in returns the buyer to this product's reviews. */
export function reviewSignInUrl(productPath: string) {
  return `/api/reviews/auth/start?returnTo=${encodeURIComponent(`${productPath}#reviews`)}`;
}

/**
 * The composer state for one product in custom mode, from the buyer's session
 * and their Shopify purchases. Without configured sign-in it is unavailable,
 * so collection stays closed.
 */
export async function getCustomReviewAccess({ productId, productPath, loadSession, findPurchases }: {
  productId: string;
  productPath: string;
  loadSession: () => Promise<CustomerSessionResult>;
  findPurchases: ReviewEligibilityLookup;
}): Promise<CustomReviewAccess> {
  if ((await getReviewPreview())?.choice === "custom-sample") return sampleAccess;
  const id = numericProductId(productId);
  if (!id) return { status: "unavailable" };
  const session = await loadSession().catch((): CustomerSessionResult => ({ status: "unavailable" }));
  if (session.status === "unavailable") return { status: "unavailable" };
  if (session.status === "sign_in_required") return { status: "signed-out", signInUrl: reviewSignInUrl(productPath) };
  const eligibility = await findPurchases(session.session, id).catch(() => ({ status: "unavailable" as const }));
  if (eligibility.status === "unavailable") return { status: "unavailable" };
  if (eligibility.status === "none" || !eligibility.purchases.length) return { status: "no-purchase" };
  return {
    status: "ready",
    buyer: eligibility.buyer,
    purchases: eligibility.purchases.map(({ lineId, label }) => ({ lineId, label })),
    defaultNameStyle: "first-initial",
    sample: false,
  };
}
