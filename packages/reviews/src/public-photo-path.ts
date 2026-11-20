const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

/** Only this same-origin endpoint can serve custom published review images. */
export function publicReviewPhotoPath(reviewId: string, revisionId: string, photoId: string) {
  return uuid(reviewId) && uuid(revisionId) && uuid(photoId)
    ? `/api/reviews/media/${reviewId}/${revisionId}/${photoId}` : null;
}
export function isPublicReviewPhotoPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split("/");
  return parts.length === 7 && parts.slice(0, 4).join("/") === "/api/reviews/media" && parts.slice(4).every(uuid);
}
