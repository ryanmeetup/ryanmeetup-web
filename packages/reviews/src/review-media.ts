import { REVIEW_PHOTOS_MAX } from "./content";

import { buyerReviewTimestamp } from "./review-backend";

/** Private buyer selection, independent of public photo URLs and moderation notes. */
export type BuyerReviewPhoto = { id: string; width: number; height: number };
export type BuyerReviewPhotoSelection = { reviewId: string; productId: string; updatedAt: string; photos: BuyerReviewPhoto[] };

const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)));

export function buyerReviewPhotoSchema(value: unknown): BuyerReviewPhoto | null {
  return exact(value, ["id", "width", "height"]) && uuid(value.id) && [value.width, value.height].every((edge) =>
    typeof edge === "number" && Number.isSafeInteger(edge) && edge >= 1 && edge <= 2048)
    ? value as BuyerReviewPhoto : null;
}

export function buyerReviewPhotoSelectionSchema(value: unknown): BuyerReviewPhotoSelection | null {
  if (!exact(value, ["reviewId", "productId", "updatedAt", "photos"]) || !uuid(value.reviewId) ||
    typeof value.productId !== "string" || !/^[1-9][0-9]{0,19}$/.test(value.productId) || !buyerReviewTimestamp(value.updatedAt) ||
    !Array.isArray(value.photos) || value.photos.length > REVIEW_PHOTOS_MAX || !value.photos.every(buyerReviewPhotoSchema) ||
    new Set(value.photos.map((photo: BuyerReviewPhoto) => photo.id)).size !== value.photos.length) return null;
  return value as BuyerReviewPhotoSelection;
}

export const REVIEW_PHOTO_STATES = ["pending", "approved", "rejected"] as const;
export type ReviewPhotoState = (typeof REVIEW_PHOTO_STATES)[number];
export type StaffReviewPhoto = BuyerReviewPhoto & { state: ReviewPhotoState };
export function staffReviewPhotoSchema(value: unknown): StaffReviewPhoto | null {
  if (!exact(value, ["id", "width", "height", "state"]) || !REVIEW_PHOTO_STATES.includes(value.state as ReviewPhotoState) ||
    !buyerReviewPhotoSchema({ id: value.id, width: value.width, height: value.height })) return null;
  return value as StaffReviewPhoto;
}
