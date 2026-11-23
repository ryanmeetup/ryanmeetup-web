"use client";

import type { CustomReviewResult, CustomReviewSubmission } from "@/components/custom-review-composer";

/** Submit a new review of one product. The server rechecks the purchase behind `lineId`. */
export async function submitCustomReview({ viewerKey, ...review }: CustomReviewSubmission & { productId: string }): Promise<CustomReviewResult> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(viewerKey ? { "X-Review-Viewer": viewerKey } : {}) },
    body: JSON.stringify(review),
  }).catch(() => null);
  const payload = (await response?.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
  if (!response?.ok) return { ok: false, error: typeof payload?.error === "string" ? payload.error : "Your review could not be submitted. Please try again.", refreshRequired: payload?.code === "viewer_changed" };
  return { ok: true, message: "Thanks! Your review is waiting for approval." };
}
