import type { ReviewPurchase } from "@ryanmeetup/reviews";
import type { CustomerAccountSession } from "./customer-account/storage";
import { lookupReviewBuyerName, lookupReviewablePurchases } from "./customer-account/review-lookups";

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
 * The adapter rereads encrypted session storage, scans bounded customer order
 * references, verifies matching orders, and checks the session again at the end.
 */
export const findReviewablePurchases: ReviewEligibilityLookup = lookupReviewablePurchases;

export type ReviewBuyerName = { firstName: string | null; lastName: string | null };
export type ReviewBuyerNameLookup = (session: CustomerAccountSession) => Promise<ReviewBuyerName | null>;

/**
 * The signed-in buyer's name from the Shopify Customer Account API, for
 * building a public name outside a specific purchase (editing on My reviews).
 * Null means the lookup failed or its session is no longer active; callers
 * preserve the stored choice or allow anonymous names in that case.
 */
export const findBuyerName: ReviewBuyerNameLookup = lookupReviewBuyerName;
