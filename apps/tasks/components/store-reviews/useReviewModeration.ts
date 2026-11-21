"use client";

import { useRef, useState } from "react";
import { toast } from "@ryanmeetup/ui";
import type { StaffReviewPhoto } from "@ryanmeetup/reviews";
import { notifyStoreReviewsChanged } from "@/hooks/useStoreReviewPendingCount";
import { ApiMutationError } from "@/lib/mutation-client";
import { saveReviewPhotoDecision, deleteStoreReview, fetchModerationPage, saveModerationDecision, saveOfficialReply } from "@/lib/store-reviews/moderation-client";
import { isPublishAction, moderationActionLabel, moderationRevisionId, reviewModerationActions, reviewReplyActions } from "@/lib/store-reviews/moderation";
import type { ModerationFilter, ModerationInitialState, ModerationPage, ModerationReview, ReviewDeletionReason, StaffReviewAction } from "@/lib/store-reviews/moderation";

type PhotoAction = "photo-approve" | "photo-reject";
export type ModerationSelection = { action: Exclude<StaffReviewAction, PhotoAction>; review: ModerationReview } |
  { action: PhotoAction; review: ModerationReview; photo: StaffReviewPhoto; revisionId: string };

export function useReviewModeration(initial: ModerationInitialState) {
  const [page, setPage] = useState<ModerationPage | null>(initial.status === "ready" ? initial.page : null);
  const [filter, setFilter] = useState<ModerationFilter>("pending");
  // Null shows every product. Product IDs stay internal to this API request.
  const [productId, setProductId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"loading" | "saving" | null>(null);
  const [selection, setSelection] = useState<ModerationSelection | null>(null);
  const [error, setError] = useState(initial.status === "error" ? "Reviews could not load. Refresh the queue to try again." : "");
  const [message, setMessage] = useState("");
  // A synchronous gate also refuses a second click before React renders disabled controls.
  const active = useRef(false);
  const disabled = initial.status === "disabled";

  async function load({ filter: nextFilter = filter, productId: nextProduct = productId, more = false }: {
    filter?: ModerationFilter; productId?: string | null; more?: boolean;
  } = {}) {
    if (disabled || active.current || selection) return;
    active.current = true;
    setBusy("loading"); setError(""); setMessage(""); setFilter(nextFilter); setProductId(nextProduct);
    try {
      const result = await fetchModerationPage(nextFilter, nextProduct, more ? page?.next : null);
      setPage((current) => more && current ? {
        ...result,
        reviews: [...current.reviews, ...result.reviews.filter((row) => !current.reviews.some((existing) => existing.id === row.id))],
      } : result);
      if (!more) notifyStoreReviewsChanged();
    } catch {
      // An unavailable page is not an empty queue, and stale decisions stay closed.
      setPage(null); setError("Reviews could not load. Refresh the queue to try again.");
    } finally { active.current = false; setBusy(null); }
  }

  function select(review: ModerationReview, action: StaffReviewAction) {
    // Any review can be deleted; the dialog limits it to policy reasons.
    const allowed: StaffReviewAction[] = [...reviewModerationActions(review), ...reviewReplyActions(review), "delete"];
    if (disabled || active.current || !allowed.includes(action)) return;
    const next = { review, action: action as Exclude<StaffReviewAction, PhotoAction> };
    // Publishing saves on click: there is nothing to confirm or explain.
    if (isPublishAction(action)) void run(next, null);
    else setSelection(next);
  }
  function selectPhoto(review: ModerationReview, revisionId: string, photo: StaffReviewPhoto, action: PhotoAction) {
    if (!disabled && !active.current && review.state !== "withdrawn") setSelection({ review, revisionId, photo, action });
  }
  function dismiss() { if (!active.current) setSelection(null); }

  function decide(note: string | null, reason?: ReviewDeletionReason) {
    return selection ? run(selection, note, reason) : Promise.resolve();
  }

  async function run(selection: ModerationSelection, note: string | null, reason?: ReviewDeletionReason) {
    if (active.current || disabled) return;
    const { review, action } = selection;
    if (action === "reply-set" && !note) return;
    if (action === "delete" && !reason) return;
    active.current = true; setBusy("saving"); setError(""); setMessage("");
    let outcome: "saved" | "conflict" | "unknown" = "unknown";
    let photosLeft = false;
    try {
      if (action === "photo-approve" || action === "photo-reject") {
        if (!("photo" in selection)) throw new Error("Photo selection is unavailable.");
        await saveReviewPhotoDecision({ reviewId: review.id, revisionId: selection.revisionId, photoId: selection.photo.id,
          expectedUpdatedAt: review.updatedAt, action: action === "photo-approve" ? "approve" : "reject", note });
      } else if (action === "delete") {
        photosLeft = !(await deleteStoreReview({ reviewId: review.id, expectedUpdatedAt: review.updatedAt, reason: reason!, note })).photosRemoved;
      } else if (action === "reply-set" || action === "reply-remove") {
        await saveOfficialReply({ reviewId: review.id, expectedUpdatedAt: review.updatedAt, body: action === "reply-remove" ? null : note });
      } else {
        await saveModerationDecision({ action, reviewId: review.id, expectedUpdatedAt: review.updatedAt,
          revisionId: moderationRevisionId(action, review), note });
      }
      outcome = "saved";
    } catch (failure) {
      if (failure instanceof ApiMutationError && failure.code === "CONFLICT") outcome = "conflict";
    }
    setSelection(null);
    // A conflict or a lost response may still have changed the queue, so the
    // sidebar re-counts after every attempt, not only a confirmed save.
    notifyStoreReviewsChanged();
    if (outcome === "unknown") {
      // A lost response may follow a committed decision. Require a fresh read, never a blind retry.
      setPage(null); setError("We could not confirm this decision. Refresh the queue before trying again.");
    } else {
      if (outcome === "saved") {
        const message = action === "delete"
          ? `Review deleted and logged.${photosLeft ? " Its photo files could not be removed and stay private." : ""}`
          : `${moderationActionLabel(action, review)}: saved.`;
        setMessage(message);
        // A confirmed save deserves feedback even if refreshing the queue fails.
        toast.success(message);
      }
      try {
        setPage(await fetchModerationPage(filter, productId));
        if (outcome === "conflict") setError(action === "delete" ? "This review changed or was already deleted. The queue has been refreshed; check it before deleting." : "This review changed. The queue has been refreshed; read the latest text before deciding.");
      } catch {
        setPage(null); setError(outcome === "saved"
          ? "Your decision was saved, but reviews could not reload. Refresh the queue before deciding again."
          : "This review changed and reviews could not reload. Refresh the queue before deciding again.");
      }
    }
    active.current = false; setBusy(null);
  }

  return { page, filter, productId, busy, selection, error, message, disabled, load, select, selectPhoto, dismiss, decide };
}
