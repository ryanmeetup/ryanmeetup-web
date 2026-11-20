/** Photos accompany signed-in reviews by default; an explicit false pauses collection. */
export function reviewPhotosEnabled() {
  const setting = process.env.STORE_REVIEW_PHOTOS_ENABLED;
  return setting === undefined || setting === "" || setting === "true";
}
