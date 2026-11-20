import { isPublicReviewPhotoPath } from "@ryanmeetup/reviews";

/** Public review images are served only by the revision-bound Store route. */
export function publishedReviewPhotoUrl(value?: string): string | null {
  return isPublicReviewPhotoPath(value) ? value : null;
}
