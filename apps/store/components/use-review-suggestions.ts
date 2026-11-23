"use client";

import { useRef, useState } from "react";
import type { ReviewSuggestions } from "@/lib/review-suggestions";
import type { ReviewSuggestionAction } from "@/lib/review-suggestion-storage";

export type ChangeReviewSuggestion = (lineId: string, action: ReviewSuggestionAction, viewerKey: string) => Promise<void>;

const changeReminder: ChangeReviewSuggestion = async (lineId, action, viewerKey) => {
  const response = await fetch("/api/reviews/suggestions", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Review-Viewer": viewerKey },
    body: JSON.stringify({ lineId, action }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== (action === "dismiss" ? "dismissed" : "restored")) {
    throw new Error(typeof result?.error === "string" ? result.error : "We couldn't confirm that reminder change. Refresh and try again.");
  }
};

/** Apply only confirmed preferences, keeping retry and restore available. */
export function useReviewSuggestions(suggestions: ReviewSuggestions, viewerKey: string, change: ChangeReviewSuggestion = changeReminder) {
  const [items, setItems] = useState(suggestions.items);
  const [dismissed, setDismissed] = useState(() => new Set(suggestions.dismissedLineIds));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const active = useRef(false);

  async function update(lineId: string, action: ReviewSuggestionAction) {
    if (active.current) return;
    active.current = true;
    setPending(lineId); setError(""); setMessage("");
    try {
      await change(lineId, action, viewerKey);
      setDismissed((current) => {
        const next = new Set(current);
        if (action === "dismiss") next.add(lineId); else next.delete(lineId);
        return next;
      });
      setMessage(action === "dismiss" ? "Reminder dismissed. You can restore it below or review from the product page anytime." : "Reminder restored to Ready to Review.");
      document.getElementById("ready-to-review")?.focus();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your reminder could not be updated. Please try again.");
    } finally { active.current = false; setPending(null); }
  }

  return {
    ready: items.filter((item) => !dismissed.has(item.lineId)),
    dismissed: items.filter((item) => dismissed.has(item.lineId)),
    pending, error, message, update,
    reviewed: (lineId: string) => setItems((current) => current.filter((item) => item.lineId !== lineId)),
  };
}
