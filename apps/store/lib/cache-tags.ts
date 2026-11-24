export const shopifyCatalogTag = "shopify-catalog";

/** Public review reads that pages render; see `getReviewBackend`. */
export const storeReviewsTag = "store-reviews";
/** Seconds a moderation change in Tasks can take to reach cached review reads. */
export const storeReviewsRevalidate = 60;

/** Anonymous sales and cart activity behind listing highlights; see `getProductActivity`. */
export const productActivityTag = "store-product-activity";
/** Seconds a sale or cart add can take to reach highlights and milestones. */
export const productActivityRevalidate = 600;
