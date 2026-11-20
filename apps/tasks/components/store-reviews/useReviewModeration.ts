"use client";

import { useRef, useState } from "react";
import { notifyStoreReviewsChanged } from "@/hooks/useStoreReviewPendingCount";
import { ApiMutationError } from "@/lib/mutation-client";
import { fetchModerationPage, saveModerationDecision, saveOfficialReply } from "@/lib/store-reviews/moderation-client";
import { moderationActionLabel, reviewModerationActions, reviewReplyActions } from "@/lib/store-reviews/moderation";
import type { ModerationFilter, ModerationInitialState, ModerationPage, ModerationReview, StaffReviewAction } from "@/lib/store-reviews/moderation";

export type ModerationSelection = { action: StaffReviewAction; review: ModerationReview };

export function useReviewModeration(initial: ModerationInitialState) {
  const [page, setPage] = useState<ModerationPage | null>(initial.status === "ready" ? initial.page : null);
  const [filter, setFilter] = useState<ModerationFilter>("pending");
  const [busy, setBusy] = useState<"loading" | "saving" | null>(null);
  const [selection, setSelection] = useState<ModerationSelection | null>(null);
  const [error, setError] = useState(initial.status === "error" ? "Reviews could not load. Refresh the queue to try again." : "");
  const [message, setMessage] = useState("");
  // A synchronous gate also refuses a second click before React renders disabled controls.
  const active = useRef(false);
  const disabled = initial.status === "disabled";

  async function load(nextFilter = filter, more = false) {
    if (disabled || active.current || selection) return;
    active.current = true;
    setBusy("loading"); setError(""); setMessage(""); setFilter(nextFilter);
    try {
      const result = await fetchModerationPage(nextFilter, more ? page?.next : null);
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
    const allowed: StaffReviewAction[] = [...reviewModerationActions(review), ...reviewReplyActions(review)];
    if (!disabled && !active.current && allowed.includes(action)) setSelection({ review, action });
  }
  function dismiss() { if (!active.current) setSelection(null); }

  async function decide(note: string | null) {
    if (!selection || active.current || disabled) return;
    const { review, action } = selection;
    if (action === "reply-set" && !note) return;
    active.current = true; setBusy("saving"); setError(""); setMessage("");
    let outcome: "saved" | "conflict" | "unknown" = "unknown";
    try {
      if (action === "reply-set" || action === "reply-remove") {
        await saveOfficialReply({ reviewId: review.id, expectedUpdatedAt: review.updatedAt, body: action === "reply-remove" ? null : note });
      } else {
        await saveModerationDecision({ action, reviewId: review.id, expectedUpdatedAt: review.updatedAt,
          revisionId: action === "approve" || action === "reject" ? review.pending!.id : null, note });
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
      if (outcome === "saved") setMessage(`${moderationActionLabel(action, review)}: saved.`);
      try {
        setPage(await fetchModerationPage(filter));
        if (outcome === "conflict") setError("This review changed. The queue has been refreshed; read the latest text before deciding.");
      } catch {
        setPage(null); setError(outcome === "saved"
          ? "Your decision was saved, but reviews could not reload. Refresh the queue before deciding again."
          : "This review changed and reviews could not reload. Refresh the queue before deciding again.");
      }
    }
    active.current = false; setBusy(null);
  }

  return { page, filter, busy, selection, error, message, disabled, load, select, dismiss, decide };
}
