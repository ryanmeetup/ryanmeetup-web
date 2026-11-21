"use client";

import { Tooltip } from "@ryanmeetup/ui";
import { FiInfo, FiShoppingBag } from "react-icons/fi";
import { HiMiniCheckBadge } from "react-icons/hi2";

export type ReviewVerification = "purchase" | "review" | "unmatched";
export type ReviewVerificationBadgeProps = { kind?: ReviewVerification; className?: string };

const purchaseMeaning = "We matched this review to the reviewer's own order of this item, so you know they actually bought it.";
const unmatchedMeaning = "We couldn't match this review to the reviewer's own order of this item. This does not mean the review is fake.";

/** Matching order status has the same shape everywhere, with a neutral unmatched state. */
export function ReviewVerificationBadge({ kind = "purchase", className = "" }: ReviewVerificationBadgeProps) {
  const unmatched = kind === "unmatched";
  const label = unmatched ? "No matching order" : kind === "purchase" ? "Verified purchase" : "Verified review";
  const meaning = unmatched ? unmatchedMeaning : kind === "purchase" ? purchaseMeaning : null;
  const Icon = unmatched ? FiShoppingBag : HiMiniCheckBadge;
  return <span className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-1 text-xs font-semibold ring-1 ring-inset ${unmatched
    ? "bg-black/5 text-black/70 ring-black/15 dark:bg-white/5 dark:text-white/70 dark:ring-white/20"
    : "bg-emerald-500/10 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/30"} ${className}`}>
    <Icon aria-hidden className="size-4 shrink-0" />
    {label}
    {meaning && <Tooltip content={meaning}>
      <button type="button" aria-label={unmatched ? "What does no matching order mean?" : "What does verified purchase mean?"}
        className="inline-grid size-4 shrink-0 place-items-center rounded-full opacity-80 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
        <FiInfo aria-hidden className="size-3.5" />
      </button>
    </Tooltip>}
  </span>;
}
