"use client";

import { useCallback, useEffect } from "react";
import { useQueryParamState } from "@ryanmeetup/hooks";

const storageKey = "ryanmeetup.tasks.notes-view";
type NotesView = "cards" | "table";
const isNotesView = (value: string | null): value is NotesView =>
  value === "cards" || value === "table";

export function useNotesView() {
  // Keep both choices explicit in shared links, including the default Cards.
  const [viewParam, setViewParam] = useQueryParamState("note-view");

  useEffect(() => {
    // Opening a link overrides this visit without changing the saved preference.
    const requested = new URLSearchParams(window.location.search).get(
      "note-view",
    );
    if (isNotesView(requested)) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (isNotesView(saved)) queueMicrotask(() => setViewParam(saved));
    } catch {
      // Browser storage can be unavailable; the URL still keeps the current view.
    }
  }, [setViewParam, viewParam]);

  const setView = useCallback(
    (value: string) => {
      if (!isNotesView(value)) return;
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        // A blocked store only loses the remembered preference between visits.
      }
      setViewParam(value);
    },
    [setViewParam],
  );

  const view: NotesView = viewParam === "table" ? "table" : "cards";
  return [view, setView] as const;
}
