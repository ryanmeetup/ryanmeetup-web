import type { IconType } from "react-icons";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiLink,
  FiClock,
  FiHelpCircle,
  FiXCircle,
  FiZap,
} from "react-icons/fi";
import { RYD_STATUS_LABELS, type RydOrderStatus } from "@/lib/ryd/orders";
import type { MatchConfidence } from "@/lib/ryd/matching";
import type { RyanPosition } from "@/lib/ryd/normalize";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

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

/** Status-coloured text, for a label that sits on no tint of its own. */
export const RYD_STATUS_TEXT: Record<RydOrderStatus, string> = {
  pending: "text-blue-700 dark:text-blue-300",
  needs_info: "text-amber-700 dark:text-amber-300",
  verified: "text-emerald-700 dark:text-emerald-300",
  rejected: "text-red-700 dark:text-red-300",
};

const CHIP =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-[11px] font-semibold normal-case tracking-normal";

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

/**
 * Said beside the buyer when their Ryan isn't a first name, read from the form
 * or else the order, so a reviewer sees it before verifying. A first-name Ryan
 * gets nothing.
 */
const RYAN_POSITION_CHIPS: Partial<
  Record<RyanPosition, { label: string; icon: IconType; className: string }>
> = {
  middle: {
    label: "Middle-name Ryan",
    icon: FiInfo,
    className:
      "border-orange-500/35 bg-orange-500/10 text-orange-800 dark:border-orange-400/35 dark:bg-orange-500/15 dark:text-orange-200",
  },
  last: {
    label: "Surname Ryan",
    icon: FiInfo,
    className:
      "border-orange-500/35 bg-orange-500/10 text-orange-800 dark:border-orange-400/35 dark:bg-orange-500/15 dark:text-orange-200",
  },
  absent: {
    label: "Non-Ryan",
    icon: FiAlertTriangle,
    className:
      "border-rose-500/35 bg-rose-500/10 text-rose-800 dark:border-rose-400/35 dark:bg-rose-500/15 dark:text-rose-200",
  },
};

export function RydRyanPositionChip({
  position,
}: {
  position: RyanPosition | null | undefined;
}) {
  const chip = position && RYAN_POSITION_CHIPS[position];
  if (!chip) return null;
  const { label, icon: Icon, className } = chip;
  return (
    <span className={`${CHIP} ${className}`}>
      <Icon aria-hidden className="h-3 w-3" />
      {label}
    </span>
  );
}

const LINKED_TINT =
  "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200";
const MISSING_TINT =
  "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-100";

/** What the form says about this order: its headline, tint, and the evidence. */
export function rydMatchEvidence(order: RydQueueOrder): {
  icon: IconType;
  title: string;
  /** For a table cell, where the full title doesn't fit. */
  shortTitle: string;
  className: string;
  reasons: string[];
} {
  if (order.linkedKeys.length)
    return {
      icon: FiLink,
      title: `Linked to ${order.linkedKeys.length} form submission${order.linkedKeys.length === 1 ? "" : "s"}`,
      shortTitle: "Linked",
      className: LINKED_TINT,
      reasons: [],
    };
  if (order.suggestion) {
    const confidence = RYD_CONFIDENCE[order.suggestion.confidence];
    return {
      icon: confidence.icon,
      title: confidence.label,
      shortTitle: confidence.label,
      className: confidence.className,
      reasons: order.suggestion.reasons,
    };
  }
  return {
    icon: FiAlertCircle,
    title: "No form submission found",
    shortTitle: "No submission",
    className: MISSING_TINT,
    reasons: [],
  };
}

export function prefersPhone(order: RydQueueOrder) {
  return /phone|text|call|sms/i.test(order.contactMethod);
}

/** The form's verdict on an order as one chip; the reasons go in its title. */
export function RydMatchChip({ order }: { order: RydQueueOrder }) {
  const {
    icon: Icon,
    shortTitle,
    title,
    className,
    reasons,
  } = rydMatchEvidence(order);
  return (
    <span
      className={`${CHIP} ${className}`}
      title={reasons.length ? `${title}: ${reasons.join(", ")}` : title}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {shortTitle}
    </span>
  );
}
