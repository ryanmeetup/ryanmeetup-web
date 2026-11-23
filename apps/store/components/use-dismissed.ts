"use client";

import { useCallback, useSyncExternalStore } from "react";

// Remembers dismissed banners in localStorage, keyed per banner. The server renders
// every banner (most visitors are new), so a returning visitor who dismissed one gets a
// brief flash rather than everyone getting a late pop-in.
const listeners = new Set<() => void>();
const sessionDismissed = new Set<string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// Storage can be blocked (private windows, cleared site data); the banner just shows again.
function isStored(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Whether the banner under `key` was dismissed, and a function that dismisses it. */
export function useDismissed(key: string) {
  const dismissed = useSyncExternalStore(subscribe, () => sessionDismissed.has(key) || isStored(key), () => false);
  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Nothing to remember it in; it still hides for this visit.
    }
    sessionDismissed.add(key);
    listeners.forEach((listener) => listener());
  }, [key]);
  return [dismissed, dismiss] as const;
}
