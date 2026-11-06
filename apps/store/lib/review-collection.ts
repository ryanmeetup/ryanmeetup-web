import { getCustomerAccountUrl, isShopifyConfigured } from "./shopify";

export type ReviewAccount = { url: string | null };

/** Configured stores collect through Shopify/Judge.me; demo mode keeps the composer preview. */
export async function getReviewAccount(): Promise<ReviewAccount | undefined> {
  if (!isShopifyConfigured()) return undefined;
  try {
    return { url: await getCustomerAccountUrl() };
  } catch (error) {
    console.error("Could not load the customer account link for review collection.", error);
    return { url: null };
  }
}
