"use client";

import type { ReviewSubmission } from "@ryanmeetup/reviews";
import { myReviewViewSchema } from "./my-review-view";

export class MyReviewRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function result(response: Response) {
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new MyReviewRequestError(typeof value?.error === "string" ? value.error : "Your reviews could not load.",response.status);
  return value;
}
export async function fetchMyReviews(cursor: string | null = null) {
  const query = cursor ? `?${new URLSearchParams({cursor})}` : "";
  const view = myReviewViewSchema(await result(await fetch(`/api/reviews/mine${query}`,{cache:"no-store"})));
  if (!view) throw new Error("Your reviews could not load.");
  return view;
}
export type MyReviewChange = { action:"edit"; reviewId:string; expectedUpdatedAt:string } & ReviewSubmission |
  { action:"withdraw"; reviewId:string; expectedUpdatedAt:string };
export async function changeMyReview(change: MyReviewChange) {
  const value = await result(await fetch("/api/reviews/mine",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(change)}));
  if (value?.status !== (change.action === "edit" ? "pending" : "withdrawn")) throw new Error("The review change could not be confirmed.");
}
