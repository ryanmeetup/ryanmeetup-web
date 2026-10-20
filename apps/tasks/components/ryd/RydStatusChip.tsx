import type { IconType } from "react-icons";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiHelpCircle,
  FiXCircle,
  FiZap,
} from "react-icons/fi";
import { RYD_STATUS_LABELS, type RydOrderStatus } from "@/lib/ryd/orders";
import type { MatchConfidence } from "@/lib/ryd/matching";

/** One colour per status, shared by the chips, the stat cards, and the rows. */
export const RYD_STATUS_TONES = {
  pending: "blue",
  needs_info: "amber",
  verified: "green",
  rejected: "red",
} as const satisfies Record<RydOrderStatus, string>;

export const RYD_STATUS_ICONS: Record<RydOrderStatus, IconType> = {
  pending: FiClock,
  needs_info: FiHelpCircle,
  verified: FiCheckCircle,
  rejected: FiXCircle,
};

/** Border, fill, and text for anything tinted by status. */
export const RYD_STATUS_TINTS: Record<RydOrderStatus, string> = {
  pending:
    "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200",
  needs_info:
    "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-100",
  verified:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  rejected:
    "border-red-500/30 bg-red-500/10 text-red-800 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200",
};

/** The left rail on an order row, so a long list sorts itself by eye. */
export const RYD_STATUS_RAILS: Record<RydOrderStatus, string> = {
  pending: "border-l-blue-500 dark:border-l-blue-400",
  needs_info: "border-l-amber-500 dark:border-l-amber-400",
  verified: "border-l-emerald-500 dark:border-l-emerald-400",
  rejected: "border-l-red-500 dark:border-l-red-400",
};

const CHIP =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold";

/**
 * Where an order stands. A chip, not a button: the label and icon carry the
 * state and the colour only reinforces it.
 */
export function RydStatusChip({ status }: { status: RydOrderStatus }) {
  const Icon = RYD_STATUS_ICONS[status];
  return (
    <span className={`${CHIP} ${RYD_STATUS_TINTS[status]}`}>
      <Icon aria-hidden className="h-3 w-3" />
      {RYD_STATUS_LABELS[status]}
    </span>
  );
}

export const RYD_CONFIDENCE: Record<
  MatchConfidence,
  { label: string; icon: IconType; className: string }
> = {
  strong: {
    label: "Strong match",
    icon: FiZap,
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  possible: {
    label: "Possible match",
    icon: FiHelpCircle,
    className:
      "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-200",
  },
  weak: {
    label: "Weak match",
    icon: FiAlertCircle,
    className:
      "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-200",
  },
};

export function RydConfidenceChip({
  confidence,
}: {
  confidence: MatchConfidence;
}) {
  const { label, icon: Icon, className } = RYD_CONFIDENCE[confidence];
  return (
    <span className={`${CHIP} ${className}`}>
      <Icon aria-hidden className="h-3 w-3" />
      {label}
    </span>
  );
}
