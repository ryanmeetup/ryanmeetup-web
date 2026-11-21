"use client";

import { buyerReviewPhotoSelectionSchema, buyerReviewPhotoSchema } from "@ryanmeetup/reviews";
import type { BuyerRejectedPhoto } from "@ryanmeetup/reviews";

/** What the picker takes. Anything over the upload limit is shrunk in the browser first. */
export const REVIEW_PHOTO_PICKER_MAX_BYTES = 25 * 1024 * 1024;
/** One upload request stays below the hosting platform's 4.5 MB body limit; matches the server's. */
const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
/** The server keeps no more than this on either edge, so shrinking to it loses nothing. */
const UPLOAD_MAX_EDGE = 2048;
/** Accepted types, for the picker and for files whose browser leaves `type` blank. */
export const REVIEW_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
/** A preview blob read back from the server is always a normalized WebP within this. */
const PREVIEW_MAX_BYTES = 4 * 1024 * 1024;
/** `rejectedPhotos` only labels the editor; requests never send it. */
export type ReviewPhotoEditorScope = { productId: string; viewerKey: string; review?: { id: string; updatedAt: string; rejectedPhotos?: BuyerRejectedPhoto[] } };
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
/** Some systems leave a HEIC file's type blank; its name is the only hint. The server still checks the bytes. */
function photoType(file: File) {
  return file.type || (/\.hei[cf]$/i.test(file.name) ? "image/heic" : "");
}

/**
 * A photo over the upload limit is redrawn at the server's own size cap.
 * Orientation is applied by the decoder; the canvas copy carries no EXIF or GPS.
 * Browsers that can't decode a format (HEIC outside Safari) leave a big file as-is
 * and the server reports the limit.
 */
async function shrinkForUpload(file: File): Promise<Blob> {
  if (file.size <= UPLOAD_MAX_BYTES) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new ReviewPhotoClientError("That photo is too big to send from this browser. Choose one under 4 MiB.");
  try {
    const scale = Math.min(1, UPLOAD_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new ReviewPhotoClientError("That photo could not be prepared. Try a smaller one.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    // WebP keeps transparency; a browser that can't write it hands back PNG, so check before using it.
    for (const type of ["image/webp", "image/jpeg"]) {
      if (type === "image/jpeg") { context.globalCompositeOperation = "destination-over"; context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); }
      const blob = await encode(type);
      if (blob?.type === type && blob.size <= UPLOAD_MAX_BYTES) return blob;
    }
    throw new ReviewPhotoClientError("That photo could not be made small enough to send. Try a smaller one.");
  } finally { bitmap.close(); }
}

export async function uploadReviewPhoto(scope: ReviewPhotoEditorScope, file: File, requestKey: string, signal: AbortSignal) {
  const body = await shrinkForUpload(file);
  const response = await checked(await fetch(`/api/reviews/photos?${query(scope, { requestKey })}`, { method: "POST", credentials: "same-origin",
    headers: { ...reviewPhotoHeaders(scope.viewerKey), "Content-Type": body === file ? photoType(file) : body.type }, body, signal }));
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
  if (!blob.size || blob.size > PREVIEW_MAX_BYTES) throw new ReviewPhotoClientError(unavailable);
  return blob;
}
export async function discardReviewPhoto(scope: ReviewPhotoEditorScope, id: string, signal: AbortSignal) {
  const response = await fetch(`/api/reviews/photos?${query(scope, { photoId: id })}`, { method: "DELETE", credentials: "same-origin",
    headers: reviewPhotoHeaders(scope.viewerKey), signal });
  // Expired/already-discarded drafts can leave the local selection. Attached objects are protected by SQL.
  if (response.status !== 404) await checked(response);
}
