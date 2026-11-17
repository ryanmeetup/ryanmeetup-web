import { getCustomerAccountUrl, isShopifyConfigured } from "./shopify";
import { getActiveReviewProvider } from "./review-preview";

export type ReviewAccount = { url: string | null };

/** Configured stores collect through Shopify/Judge.me; demo mode keeps the composer preview. */
export async function getReviewAccount(): Promise<ReviewAccount | undefined> {
  // No composer or hosted Judge.me handoff until custom buyer auth is ready.
  if (await getActiveReviewProvider() !== "judgeme") return { url: null };
  if (!isShopifyConfigured()) return undefined;
  try {
    return { url: await getCustomerAccountUrl() };
  } catch (error) {
    console.error("Could not load the customer account link for review collection.", error);
    return { url: null };
  }
}
