"use client";

import { useRef, useState } from "react";
import { toast } from "@ryanmeetup/ui";
import type { StaffReviewPhoto } from "@ryanmeetup/reviews";
import { notifyStoreReviewsChanged } from "@/hooks/useStoreReviewPendingCount";
import { ApiMutationError } from "@/lib/mutation-client";
import { saveReviewPhotoDecision, deleteStoreReview, fetchModerationPage, saveModerationDecision, saveOfficialReply } from "@/lib/store-reviews/moderation-client";
import { isPublishAction, moderationActionLabel, moderationRevisionId, reviewModerationActions, reviewReplyActions } from "@/lib/store-reviews/moderation";
import type { ModerationFilter, ModerationInitialState, ModerationPage, ModerationReview, ReviewDeletionReason, StaffReviewAction } from "@/lib/store-reviews/moderation";
import { bulkReviewActionLabels, bulkReviewTargets } from "@/lib/store-reviews/bulk-moderation";
import type { BulkReviewAction } from "@/lib/store-reviews/bulk-moderation";
import { saveBulkReviewActions } from "@/lib/store-reviews/bulk-moderation-client";

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
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkSelection, setBulkSelection] = useState<{ action: BulkReviewAction; reviews: ModerationReview[] } | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState(initial.status === "error" ? "Reviews could not load. Refresh the queue to try again." : "");
  // A synchronous gate also refuses a second click before React renders disabled controls.
  const active = useRef(false);
  const disabled = initial.status === "disabled";

  async function load({ filter: nextFilter = filter, productId: nextProduct = productId, more = false, minimumReviews = 0 }: {
    filter?: ModerationFilter; productId?: string | null; more?: boolean; minimumReviews?: number;
  } = {}) {
    if (disabled || active.current || selection || bulkSelection) return;
    active.current = true;
    setBusy("loading"); setError(""); setFilter(nextFilter); setProductId(nextProduct);
    setSelectedIds(new Set());
    try {
      let result = more ? page : null;
      do {
        const next = await fetchModerationPage(nextFilter, nextProduct, result?.next ?? null);
        const reviews = result ? [...result.reviews, ...next.reviews.filter((row) => !result!.reviews.some((existing) => existing.id === row.id))] : next.reviews;
        if (result && next.next && reviews.length === result.reviews.length) throw new Error("Review page did not advance");
        result = { ...next, reviews, total: result ? result.total : next.total };
      } while (result.next && result.reviews.length < minimumReviews);
      setPage(result);
      if (!more) notifyStoreReviewsChanged();
      return true;
    } catch {
      // An unavailable page is not an empty queue, and stale decisions stay closed.
      setPage(null); setError("Reviews could not load. Refresh the queue to try again.");
      setSelectedIds(new Set());
    } finally { active.current = false; setBusy(null); }
  }

  function select(review: ModerationReview, action: StaffReviewAction) {
    // Any review can be deleted; the dialog limits it to policy reasons.
    const allowed: StaffReviewAction[] = [...reviewModerationActions(review), ...reviewReplyActions(review), "delete"];
    if (disabled || active.current || selection || bulkSelection || !allowed.includes(action)) return;
    const next = { review, action: action as Exclude<StaffReviewAction, PhotoAction> };
    // Publishing saves on click: there is nothing to confirm or explain.
    if (isPublishAction(action)) void run(next, null);
    else setSelection(next);
  }
  function selectPhoto(review: ModerationReview, revisionId: string, photo: StaffReviewPhoto, action: PhotoAction) {
    if (!disabled && !active.current && !selection && !bulkSelection && review.state !== "withdrawn") setSelection({ review, revisionId, photo, action });
  }
  function dismiss() { if (!active.current) { setSelection(null); setBulkSelection(null); } }

  function toggleReview(id: string) {
    if (disabled || active.current || selection || bulkSelection || !page?.reviews.some((review) => review.id === id)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  /** Selects or clears the reviews on screen; a search narrows them below what is loaded. */
  function toggleAll(visible: ModerationReview[]) {
    if (disabled || active.current || selection || bulkSelection || !page) return;
    setSelectedIds((current) => visible.every((review) => current.has(review.id)) ? new Set() : new Set(visible.map((review) => review.id)));
  }
  function clearSelected() {
    if (!active.current && !selection && !bulkSelection) setSelectedIds(new Set());
  }
  /** Acts only on selected reviews still on screen, so a search never hides one from the batch. */
  function selectBulk(action: BulkReviewAction, visible: ModerationReview[]) {
    if (disabled || active.current || selection || bulkSelection || !page) return;
    const reviews = bulkReviewTargets(visible.filter((review) => selectedIds.has(review.id)), action);
    if (!reviews.length) return;
    const next = { action, reviews };
    if (isPublishAction(action)) void runBulk(next, null);
    else setBulkSelection(next);
  }
  function decideBulk(note: string | null, reason?: ReviewDeletionReason) {
    return bulkSelection ? runBulk(bulkSelection, note, reason) : Promise.resolve();
  }

  async function runBulk(batch: { action: BulkReviewAction; reviews: ModerationReview[] }, note: string | null, reason?: ReviewDeletionReason) {
    if (disabled || active.current || (batch.action === "delete" && !reason) ||
      ((batch.action === "reject" || batch.action === "hide") && !note?.trim())) return;
    active.current = true; setBusy("saving"); setError("");
    setBulkProgress({ completed: 0, total: batch.reviews.length });
    try {
      const result = await saveBulkReviewActions({ ...batch, note, reason,
        onProgress: (completed) => setBulkProgress({ completed, total: batch.reviews.length }) });
      if (result.saved) toast.success(`${bulkReviewActionLabels[batch.action]}: saved ${result.saved} of ${batch.reviews.length}.${result.photosLeft ? " Some photo files could not be removed and stay private." : ""}`);
      if (result.uncertain) {
        setPage(null);
        setError(`Bulk action stopped: one decision could not be confirmed. ${result.saved} saved, ${result.conflicts} changed, ${result.unattempted} not attempted. Refresh the queue before trying again.`);
      } else {
        try {
          setPage(await fetchModerationPage(filter, productId));
          if (result.conflicts) setError(`${result.conflicts} selected review${result.conflicts === 1 ? "" : "s"} changed and ${result.conflicts === 1 ? "was" : "were"} skipped. The queue has been refreshed; read the latest text before deciding.`);
        } catch {
          setPage(null);
          setError(`Bulk action finished: ${result.saved} saved, ${result.conflicts} changed. Reviews could not reload. Refresh the queue before deciding again.`);
        }
      }
    } catch {
      setPage(null); setError("The bulk action could not be confirmed. Refresh the queue before trying again.");
    } finally {
      setSelectedIds(new Set()); setBulkSelection(null); setBulkProgress(null);
      notifyStoreReviewsChanged(); active.current = false; setBusy(null);
    }
  }

  function decide(note: string | null, reason?: ReviewDeletionReason) {
    return selection ? run(selection, note, reason) : Promise.resolve();
  }

  async function run(selection: ModerationSelection, note: string | null, reason?: ReviewDeletionReason) {
    if (active.current || disabled) return;
    const { review, action } = selection;
    if (action === "reply-set" && !note) return;
    if (action === "delete" && !reason) return;
    active.current = true; setBusy("saving"); setError("");
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
    setSelectedIds(new Set());
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

  return { page, filter, productId, busy, selection, error, disabled, load, select, selectPhoto, dismiss, decide,
    selectedIds, bulkSelection, bulkProgress, toggleReview, toggleAll, clearSelected, selectBulk, decideBulk };
}
