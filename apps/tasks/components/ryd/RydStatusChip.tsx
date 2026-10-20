import { RYD_STATUS_LABELS, type RydOrderStatus } from "@/lib/ryd/orders";
import type { MatchConfidence } from "@/lib/ryd/matching";

const STATUS_DOTS: Record<RydOrderStatus, string> = {
  pending: "bg-black/35 dark:bg-white/40",
  verified: "bg-emerald-500",
  needs_info: "bg-amber-500",
  rejected: "bg-red-500",
};

/**
 * Where an order stands. A chip, not a button: the label carries the state and
 * the dot only reinforces it, so nothing depends on colour alone.
 */
export function RydStatusChip({ status }: { status: RydOrderStatus }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-0.5 text-[11px] font-semibold text-black/70 dark:border-white/10 dark:text-white/70">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status]}`}
      />
      {RYD_STATUS_LABELS[status]}
    </span>
  );
}

const CONFIDENCE_LABELS: Record<MatchConfidence, string> = {
  strong: "Strong match",
  possible: "Possible match",
  weak: "Weak match",
};

export function RydConfidenceChip({
  confidence,
}: {
  confidence: MatchConfidence;
}) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-black/[0.06] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/70 dark:bg-white/10 dark:text-white/70">
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}
