"use client";

import { useState } from "react";
import type { BuyerReview, ReviewSubmission } from "@ryanmeetup/reviews";
import { Button } from "@ryanmeetup/ui";
import { changeMyReview, MyReviewRequestError } from "@/lib/my-reviews-client";
import { buyerReviewNameChoices, type MyReviewProduct } from "@/lib/my-review-view";
import type { ReviewBuyerName } from "@/lib/review-purchases";
import { CustomReviewComposer, type CustomReviewPresentation, type CustomReviewResult } from "./custom-review-composer";
import { ReviewRouteDone, useLeaveReviewRoute } from "./review-route";

export type MyReviewEdit = ReviewSubmission & { photoIds?: string[]; viewerKey?: string };

/**
 * The composer set up to edit one of the buyer's own reviews: a dialog on My
 * reviews, or the page at `/reviews/mine/[reviewId]/edit` on a phone.
 */
export function MyReviewEditor({ review, product, buyerName, viewerKey, photosEnabled, presentation, onClose, onSubmit }: {
  review: BuyerReview;
  product: MyReviewProduct | null | undefined;
  buyerName: ReviewBuyerName | null;
  viewerKey: string;
  photosEnabled: boolean;
  presentation: CustomReviewPresentation;
  onClose: () => void;
  onSubmit: (edit: MyReviewEdit) => Promise<CustomReviewResult>;
}) {
  const label = review.item.variantTitle ? `${review.item.productTitle} · ${review.item.variantTitle}` : review.item.productTitle;
  return (
    <CustomReviewComposer
      presentation={presentation}
      open
      access={{ status: "ready", buyer: { firstName: null, lastName: null }, purchases: review.lineId ? [{ lineId: review.lineId, label }] : [], defaultNameStyle: review.current.nameStyle }}
      product={{ title: review.item.productTitle, featuredImage: product?.image ? { ...product.image, width: null, height: null } : null }}
      edit={{ initial: review.current, nameChoices: buyerReviewNameChoices(review, buyerName) }}
      photos={photosEnabled ? { productId: review.item.productId, viewerKey, review: { id: review.id, updatedAt: review.updatedAt, rejectedPhotos: review.rejectedPhotos } } : undefined}
      onClose={onClose}
      onSubmit={(submission) => onSubmit({ rating: submission.rating, title: submission.title, body: submission.body, nameStyle: submission.nameStyle,
        ...(submission.photoIds ? { photoIds: submission.photoIds, viewerKey: submission.viewerKey } : {}) })}
    />
  );
}

/** `/reviews/mine/[reviewId]/edit`: the My reviews editor as the page a phone opens. */
export function EditReviewRoute({ review, ...context }: {
  review: BuyerReview;
  product: MyReviewProduct | null;
  buyerName: ReviewBuyerName | null;
  viewerKey: string;
  photosEnabled: boolean;
}) {
  const leave = useLeaveReviewRoute("/reviews/mine");
  const [saved, setSaved] = useState(false);
  if (saved) {
    return (
      <ReviewRouteDone title="Changes saved" message="Your changes are waiting for approval. Until then, your current review stays as it is.">
        <Button.Link href="/reviews/mine" size="md" className="w-full sm:w-auto">Back to My reviews</Button.Link>
      </ReviewRouteDone>
    );
  }
  return (
    <MyReviewEditor {...context} review={review} presentation="page" onClose={leave} onSubmit={async (edit) => {
      try {
        await changeMyReview({ action: "edit", reviewId: review.id, expectedUpdatedAt: review.updatedAt, ...edit });
        setSaved(true);
        return { ok: true, message: "" };
      } catch (failure) {
        return { ok: false, error: failure instanceof MyReviewRequestError ? failure.message : "We could not confirm this change. Check My reviews before trying again." };
      }
    }} />
  );
}
