import { ANONYMOUS_REVIEWER_NAME, reviewDisplayName, reviewResultSchema } from "@ryanmeetup/reviews";
import type { BuyerReview, BuyerReviewPage, ReviewNameStyle } from "@ryanmeetup/reviews";
import type { ReviewBuyerName } from "./review-purchases";

/** Storefront facts about a reviewed product, keyed by its numeric Shopify ID. Absent once a product leaves the storefront. */
export type MyReviewProduct = { href: string; image: { url: string; altText: string | null } | null; options: string[] };
export type MyReviewView = { page: BuyerReviewPage; products: Record<string, MyReviewProduct>; buyerName: ReviewBuyerName | null; viewerKey: string; photosEnabled?: true };

const short = (value: unknown, max: number) => typeof value === "string" && [...value].length <= max;
function productSchema(value: unknown): value is MyReviewProduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { href, image, options, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length || typeof href !== "string" || !/^\/products\/[^/?#\s]{1,255}#reviews$/.test(href)) return false;
  if (!Array.isArray(options) || options.length > 3 || !options.every((option) => short(option, 255))) return false;
  if (image === null) return true;
  if (!image || typeof image !== "object" || Array.isArray(image) || Object.keys(image).length !== 2) return false;
  const { url, altText } = image as Record<string, unknown>;
  return short(url, 2048) && (url as string).startsWith("https://") && (altText === null || short(altText, 512));
}
function productsSchema(value: unknown): Record<string, MyReviewProduct> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  return entries.length <= 50 && entries.every(([id, product]) => /^[1-9][0-9]{0,19}$/.test(id) && productSchema(product)) ? value as Record<string, MyReviewProduct> : null;
}

export function buyerReviewNameChoices(review: BuyerReview, name: ReviewBuyerName | null) {
  const choices = new Map<ReviewNameStyle,string>();
  if (name?.firstName) for (const style of ["full","first-initial"] as const) choices.set(style,reviewDisplayName(style,name));
  choices.set("anonymous", ANONYMOUS_REVIEWER_NAME);
  // Unchanged styles preserve the name already stored with the review.
  choices.set(review.current.nameStyle,review.current.displayName);
  return [...choices].map(([style,displayName]) => ({ style,displayName }));
}

export function myReviewViewSchema(value: unknown): MyReviewView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string,unknown>;
  if (Object.keys(row).length !== (row.photosEnabled === true ? 5 : 4) ||
    (Object.hasOwn(row,"photosEnabled") && row.photosEnabled !== true) || typeof row.viewerKey !== "string" || !/^[a-f0-9]{64}$/.test(row.viewerKey)) return null;
  const page = reviewResultSchema("reviews.mine",{data:row.page});
  const products = productsSchema(row.products);
  if (!page || !products) return null;
  const name = row.buyerName as ReviewBuyerName | null;
  if (name !== null && (!name || typeof name !== "object" || Array.isArray(name) || Object.keys(name).length !== 2 ||
    ![name.firstName,name.lastName].every((part) => part === null || (typeof part === "string" && [...part].length <= 255)))) return null;
  return { page:page.data,products,buyerName:name,viewerKey:row.viewerKey, ...(row.photosEnabled === true ? {photosEnabled:true} : {}) };
}
