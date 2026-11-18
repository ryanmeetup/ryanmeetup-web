"use client";

import { useRef, useState } from "react";
import { ApiMutationError } from "@/lib/mutation-client";
import { fetchModerationPage, saveModerationDecision } from "@/lib/store-reviews/moderation-client";
import { moderationActionLabel, reviewModerationActions } from "@/lib/store-reviews/moderation";
import type { ModerationAction, ModerationFilter, ModerationInitialState, ModerationPage, ModerationReview } from "@/lib/store-reviews/moderation";

export type ModerationSelection = { action: ModerationAction; review: ModerationReview };

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
    } catch {
      // An unavailable page is not an empty queue, and stale decisions stay closed.
      setPage(null); setError("Reviews could not load. Refresh the queue to try again.");
    } finally { active.current = false; setBusy(null); }
  }

  function select(review: ModerationReview, action: ModerationAction) {
    if (!disabled && !active.current && reviewModerationActions(review).includes(action)) setSelection({ review, action });
  }
  function dismiss() { if (!active.current) setSelection(null); }

  async function decide(note: string | null) {
    if (!selection || active.current || disabled) return;
    const { review, action } = selection;
    active.current = true; setBusy("saving"); setError(""); setMessage("");
    let outcome: "saved" | "conflict" | "unknown" = "unknown";
    try {
      await saveModerationDecision({ action, reviewId: review.id, expectedUpdatedAt: review.updatedAt,
        revisionId: action === "approve" || action === "reject" ? review.pending!.id : null, note });
      outcome = "saved";
    } catch (failure) {
      if (failure instanceof ApiMutationError && failure.code === "CONFLICT") outcome = "conflict";
    }
    setSelection(null);
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
