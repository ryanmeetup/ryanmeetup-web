"use client";

import Link from "next/link";

/** Repeats the no-returns rule where shoppers commit to an order. `onNavigate` closes a drawer on the way out. */
export function FinalSaleNote({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <strong className="font-semibold text-black dark:text-white">All sales are final.</strong>{" "}
      <Link
        href="/policies/refund-policy"
        onClick={onNavigate}
        className="rounded-sm underline decoration-black/30 underline-offset-4 transition hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40"
      >
        Return policy
      </Link>
    </>
  );
}
