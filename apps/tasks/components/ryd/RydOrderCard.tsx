import {
  FiArrowRight,
  FiCalendar,
  FiHash,
  FiMail,
  FiMessageSquare,
  FiPhone,
  FiSend,
} from "react-icons/fi";
import { Button, CopyText } from "@ryanmeetup/ui";
import type { RyanPosition } from "@/lib/ryd/normalize";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  prefersPhone,
  rydMatchEvidence,
  RYD_STATUS_ICONS,
  RYD_STATUS_RAILS,
  RYD_STATUS_TINTS,
  RydRyanPositionChip,
  RydStatusChip,
} from "./RydStatusChip";

/**
 * One order in the queue: who, where it stands, what the form says, then the
 * order details and actions in a footer, so each card reads top to bottom.
 */
export function RydOrderCard({
  order,
  ryanPosition,
  followUp,
  emailConfigured,
  emailing,
  onEmail,
  onReview,
}: {
  order: RydQueueOrder;
  /** Where Ryan falls in the buyer's name, from `orderRyanPositions`. */
  ryanPosition: RyanPosition | null | undefined;
  /** Shows when the buyer was last emailed and the button to email them. */
  followUp: boolean;
  emailConfigured: boolean;
  /** The order being emailed, if any; every email button waits on it. */
  emailing: string | null;
  onEmail: () => void;
  onReview: () => void;
}) {
  const StatusIcon = RYD_STATUS_ICONS[order.status];
  const match = rydMatchEvidence(order);
  const MatchIcon = match.icon;
  const ContactIcon = prefersPhone(order) ? FiPhone : FiMail;
  const name = `${order.firstName} ${order.lastName}`.trim();

  return (
    <li
      className={`flex flex-col rounded-2xl border border-l-4 border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03] ${RYD_STATUS_RAILS[order.status]}`}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          aria-hidden
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${RYD_STATUS_TINTS[order.status]}`}
        >
          <StatusIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate font-semibold">
              {name || order.displayEmail}
            </p>
            <RydRyanPositionChip position={ryanPosition} />
          </div>
          <p className="truncate text-sm text-black/70 dark:text-white/70">
            {order.displayEmail}
          </p>
        </div>
        <RydStatusChip status={order.status} />
      </div>

      <div className="space-y-2 px-4 pb-4">
        <div className={`rounded-xl border px-3 py-2 ${match.className}`}>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MatchIcon aria-hidden className="h-4 w-4 shrink-0" />
            {match.title}
          </p>
          {match.reasons.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {match.reasons.map((reason) => (
                <li
                  key={reason}
                  className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-black/75 dark:bg-black/30 dark:text-white/80"
                >
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
        {order.note && (
          <p className="flex items-start gap-2 rounded-xl bg-black/[0.04] px-3 py-2 text-sm text-black/70 dark:bg-white/[0.05] dark:text-white/70">
            <FiMessageSquare aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">{order.note}</span>
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black/70 dark:text-white/70">
          <div className="flex items-center gap-1">
            <dt>
              <FiHash aria-hidden className="shrink-0" />
              <span className="sr-only">Order</span>
            </dt>
            <dd className="font-semibold tabular-nums">
              <CopyText value={order.orderId} label="order number" />
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>
              <FiCalendar aria-hidden className="shrink-0" />
              <span className="sr-only">Ordered</span>
            </dt>
            <dd>{order.orderedAt || "No date"}</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt>
              <ContactIcon aria-hidden className="shrink-0" />
              <span className="sr-only">Prefers</span>
            </dt>
            <dd className="capitalize">
              {order.contactMethod.toLowerCase() || "email"}
            </dd>
          </div>
          {followUp && order.lastEmailedAt && (
            <div className="flex items-center gap-1">
              <dt>
                <FiSend aria-hidden className="shrink-0" />
                <span className="sr-only">Emailed</span>
              </dt>
              <dd>{new Date(order.lastEmailedAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {followUp && order.status !== "rejected" && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full sm:w-auto"
              leftIcon={<FiMail aria-hidden />}
              disabled={!emailConfigured || emailing !== null}
              loading={emailing === order.orderId}
              onClick={onEmail}
            >
              {order.lastEmailedAt ? "Email again" : "Email"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            rightIcon={<FiArrowRight aria-hidden />}
            aria-label={`Review ${name || order.displayEmail}`}
            onClick={onReview}
          >
            Review
          </Button>
        </div>
      </div>
    </li>
  );
}
