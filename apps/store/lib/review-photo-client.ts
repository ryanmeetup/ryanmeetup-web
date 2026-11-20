"use client";

import { buyerReviewPhotoSelectionSchema, buyerReviewPhotoSchema } from "@ryanmeetup/reviews";

export const REVIEW_PHOTO_PICKER_MAX_BYTES = 4 * 1024 * 1024;
export type ReviewPhotoEditorScope = { productId: string; viewerKey: string; review?: { id: string; updatedAt: string } };
export class ReviewPhotoClientError extends Error {
  constructor(message: string, readonly refreshRequired = false) { super(message); }
}
const unavailable = "Your photos could not load. Try again, or remove the photo before saving.";
export const reviewPhotoHeaders = (viewerKey: string) => ({ "X-Review-Viewer": viewerKey });
async function checked(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ReviewPhotoClientError(typeof body?.error === "string" ? body.error : unavailable,
      response.status === 401 || body?.code === "viewer_changed");
  }
  return response;
}
function sameViewer(response: Response, scope: ReviewPhotoEditorScope) {
  if (response.headers.get("x-review-viewer") !== scope.viewerKey) throw new ReviewPhotoClientError("Your account changed. Close this review and refresh.", true);
}
const query = (scope: ReviewPhotoEditorScope, values: Record<string, string>) => new URLSearchParams({ productId: scope.productId, ...values });

export async function checkReviewPhotoViewer(scope: ReviewPhotoEditorScope, signal: AbortSignal) {
  const response = await checked(await fetch("/api/reviews/photos/context", { cache: "no-store", credentials: "same-origin", headers: reviewPhotoHeaders(scope.viewerKey), signal }));
  const value = await response.json();
  if (value?.viewerKey !== scope.viewerKey) throw new ReviewPhotoClientError("Your account changed. Close this review and refresh.", true);
}
export async function fetchReviewPhotoSelection(scope: ReviewPhotoEditorScope, signal: AbortSignal) {
  const response = await checked(await fetch(`/api/reviews/photos/selection?${new URLSearchParams({ reviewId: scope.review!.id })}`,
    { cache: "no-store", credentials: "same-origin", headers: reviewPhotoHeaders(scope.viewerKey), signal }));
  sameViewer(response, scope);
  const value = buyerReviewPhotoSelectionSchema((await response.json())?.selection);
  if (!value || value.reviewId !== scope.review?.id || value.productId !== scope.productId) throw new ReviewPhotoClientError(unavailable);
  if (value.updatedAt !== scope.review.updatedAt) throw new ReviewPhotoClientError("This review changed. Close it and refresh your reviews before editing.", true);
  return value.photos;
}
export async function uploadReviewPhoto(scope: ReviewPhotoEditorScope, file: File, requestKey: string, signal: AbortSignal) {
  const response = await checked(await fetch(`/api/reviews/photos?${query(scope, { requestKey })}`, { method: "POST", credentials: "same-origin",
    headers: { ...reviewPhotoHeaders(scope.viewerKey), "Content-Type": file.type }, body: file, signal }));
  sameViewer(response, scope);
  const value = await response.json();
  const photo = value?.photo;
  if (value?.status !== "ready" || !photo || Object.keys(photo).length !== 4 || !buyerReviewPhotoSchema({ id: photo.id, width: photo.width, height: photo.height }) ||
    typeof photo.expiresAt !== "string" || !Number.isFinite(Date.parse(photo.expiresAt)) || Date.parse(photo.expiresAt) <= Date.now()) throw new ReviewPhotoClientError("That upload could not be confirmed. Retry this photo before saving.");
  return photo as { id: string; width: number; height: number; expiresAt: string };
}
export async function fetchReviewPhotoBlob(scope: ReviewPhotoEditorScope, id: string, signal: AbortSignal) {
  const response = await checked(await fetch(`/api/reviews/photos?${query(scope, { photoId: id })}`,
    { cache: "no-store", credentials: "same-origin", headers: reviewPhotoHeaders(scope.viewerKey), signal }));
  sameViewer(response, scope);
  if (response.headers.get("content-type")?.split(";")[0] !== "image/webp") throw new ReviewPhotoClientError(unavailable);
  const blob = await response.blob();
  if (!blob.size || blob.size > REVIEW_PHOTO_PICKER_MAX_BYTES) throw new ReviewPhotoClientError(unavailable);
  return blob;
}
export async function discardReviewPhoto(scope: ReviewPhotoEditorScope, id: string, signal: AbortSignal) {
  const response = await fetch(`/api/reviews/photos?${query(scope, { photoId: id })}`, { method: "DELETE", credentials: "same-origin",
    headers: reviewPhotoHeaders(scope.viewerKey), signal });
  // Expired/already-discarded drafts can leave the local selection. Attached objects are protected by SQL.
  if (response.status !== 404) await checked(response);
}
