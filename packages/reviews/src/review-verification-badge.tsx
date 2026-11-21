"use client";

import { Tooltip } from "@ryanmeetup/ui";
import { FiInfo, FiShoppingBag } from "react-icons/fi";
import { HiMiniCheckBadge } from "react-icons/hi2";

export type ReviewVerification = "purchase" | "etsy" | "unmatched";
export type ReviewVerificationBadgeProps = { kind?: ReviewVerification; className?: string };

/**
 * `short` is what the badge shows; verified kinds share one word and keep
 * the source for the tooltip and screen readers, so a list of reviews isn't
 * a wall of long chips.
 */
const badges: Record<ReviewVerification, { label: string; short: string; question: string; meaning: string }> = {
  purchase: {
    label: "Verified purchase", short: "Verified", question: "What does verified purchase mean?",
    meaning: "We matched this review to the reviewer's own order of this item, so you know they actually bought it.",
  },
  etsy: {
    label: "Verified Etsy purchase", short: "Verified", question: "What does verified Etsy purchase mean?",
    meaning: "This review was left on the Ryan Meetup Etsy shop, where only buyers can leave a review, and brought over to this store.",
  },
  unmatched: {
    label: "No matching order", short: "No matching order", question: "What does no matching order mean?",
    meaning: "We couldn't match this review to the reviewer's own order of this item. This does not mean the review is fake.",
  },
};

/** Matching order status has the same shape everywhere, with a neutral unmatched state. */
export function ReviewVerificationBadge({ kind = "purchase", className = "" }: ReviewVerificationBadgeProps) {
  const unmatched = kind === "unmatched";
  const { label, short, question, meaning } = badges[kind];
  const Icon = unmatched ? FiShoppingBag : HiMiniCheckBadge;
  return <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-1.5 pr-1 text-xs font-semibold ring-1 ring-inset ${unmatched
    ? "bg-black/5 text-black/70 ring-black/15 dark:bg-white/5 dark:text-white/70 dark:ring-white/20"
    : "bg-emerald-500/10 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/30"} ${className}`}>
    <Icon aria-hidden className="size-4 shrink-0" />
    {/* The visible word starts the full label, so the rest is announced rather than shown. */}
    <span>{short}<span className="sr-only">{label.slice(short.length)}</span></span>
    <Tooltip content={<><strong className="font-semibold">{label}.</strong> {meaning}</>}>
      <button type="button" aria-label={question}
        className="inline-grid size-4 shrink-0 place-items-center rounded-full opacity-80 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
        <FiInfo aria-hidden className="size-3.5" />
      </button>
    </Tooltip>
  </span>;
}
