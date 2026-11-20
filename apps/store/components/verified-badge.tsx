"use client";

import { Tooltip } from "@ryanmeetup/ui";
import { FiInfo } from "react-icons/fi";
import { HiMiniCheckBadge } from "react-icons/hi2";

const meaning = "We matched this review to the reviewer's own order of this item, so you know they actually bought it.";

/**
 * The Verified purchase badge on product reviews and My Reviews, with an info
 * button explaining what verified means. The button is focusable so keyboard
 * and touch users can read the explanation too.
 */
export function VerifiedBadge({ kind = "purchase" }: { kind?: "purchase" | "review" }) {
  // Only a verified purchase has a meaning we can state; older "verified review" badges carry no explanation.
  const label = kind === "purchase" ? "Verified purchase" : "Verified review";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 py-0.5 pl-1.5 pr-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/25 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/30">
      <HiMiniCheckBadge aria-hidden className="size-4 shrink-0" />
      {label}
      {kind === "purchase" && <Tooltip content={meaning}>
        <button type="button" aria-label="What does verified purchase mean?"
          className="inline-grid size-4 place-items-center rounded-full text-emerald-800/70 transition hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:text-emerald-200/70 dark:hover:text-emerald-100">
          <FiInfo aria-hidden className="size-3.5" />
        </button>
      </Tooltip>}
    </span>
  );
}
