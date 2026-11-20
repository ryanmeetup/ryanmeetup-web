/** Collection is staged separately from text reviews; it stays off until media moderation is ready. */
export const reviewPhotosEnabled = () => process.env.STORE_REVIEW_PHOTOS_ENABLED === "true";
