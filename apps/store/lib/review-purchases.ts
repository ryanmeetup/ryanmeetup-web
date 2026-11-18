import type { ReviewPurchase } from "@ryanmeetup/reviews";
import type { CustomerAccountSession } from "./customer-account/storage";

/** A purchased line the signed-in buyer may review, with a label safe to show them. */
export type ReviewablePurchaseLine = ReviewPurchase & { label: string };

/**
 * What Shopify says about a signed-in buyer and one product. `unavailable`
 * means the lookup itself failed, never "bought nothing".
 */
export type ReviewEligibility =
  | { status: "eligible"; buyer: { firstName: string | null; lastName: string | null }; purchases: ReviewablePurchaseLine[] }
  | { status: "none" }
  | { status: "unavailable" };

export type ReviewEligibilityLookup = (session: CustomerAccountSession, productId: string) => Promise<ReviewEligibility>;

/**
 * Exact-line eligibility from the Shopify Customer Account API: the buyer's
 * paid, fulfilled lines for this product, rechecked on every write.
 *
 * Not built yet (handoff chunk 2). Until it is, every buyer is reported as
 * unavailable, so custom collection stays closed even with sign-in enabled.
 */
export const findReviewablePurchases: ReviewEligibilityLookup = async () => ({ status: "unavailable" });
