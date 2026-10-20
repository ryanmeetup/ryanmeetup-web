import { FiMail, FiPhone } from "react-icons/fi";
import { Button } from "@ryanmeetup/ui";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  prefersPhone,
  RYD_STATUS_RAILS,
  rydMatchEvidence,
  RydMatchChip,
  RydStatusChip,
} from "./RydStatusChip";

/**
 * The queue as one dense table, for working down a long list. It carries the
 * same status rail, chips, and actions as the cards, one row per order.
 */
export function RydOrderTable({
  orders,
  label,
  followUp,
  emailConfigured,
  emailing,
  onEmail,
  onReview,
}: {
  orders: RydQueueOrder[];
  label: string;
  followUp: boolean;
  emailConfigured: boolean;
  emailing: string | null;
  onEmail: (order: RydQueueOrder) => void;
  onReview: (order: RydQueueOrder) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[880px] table-fixed text-left text-sm">
        <caption className="sr-only">{label}</caption>
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[13%]" />
          <col className="w-[27%]" />
          <col className="w-[18%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead className="border-b border-black/10 bg-black/[0.025] text-[10px] uppercase tracking-[0.16em] text-black/60 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/60">
          <tr>
            <th className="px-4 py-3 font-semibold">Ryan</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Form</th>
            <th className="px-3 py-3 font-semibold">Order</th>
            <th className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10 dark:divide-white/10">
          {orders.map((order) => {
            const name = `${order.firstName} ${order.lastName}`.trim();
            const { reasons } = rydMatchEvidence(order);
            const ContactIcon = prefersPhone(order) ? FiPhone : FiMail;
            return (
              <tr
                key={order.orderId}
                className="transition hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"
              >
                <td
                  className={`border-l-4 px-4 py-2.5 ${RYD_STATUS_RAILS[order.status]}`}
                >
                  <button
                    type="button"
                    className="block max-w-full truncate text-left font-semibold underline decoration-black/20 underline-offset-4 transition hover:decoration-black focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 dark:decoration-white/25 dark:hover:decoration-white dark:focus-visible:ring-white/70"
                    title={name || order.displayEmail}
                    onClick={() => onReview(order)}
                  >
                    {name || order.displayEmail}
                  </button>
                  <span
                    className="block truncate text-xs text-black/70 dark:text-white/70"
                    title={order.displayEmail}
                  >
                    {order.displayEmail}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <RydStatusChip status={order.status} />
                </td>
                <td className="px-3 py-2.5">
                  <RydMatchChip order={order} />
                  {reasons.length > 0 && (
                    <span
                      className="mt-1 block truncate text-xs text-black/70 dark:text-white/70"
                      title={reasons.join(" · ")}
                    >
                      {reasons.join(" · ")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-black/70 dark:text-white/70">
                  <span className="block font-semibold tabular-nums text-black dark:text-white">
                    #{order.orderId}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">
                      {order.orderedAt || "No date"}
                    </span>
                    <ContactIcon aria-hidden className="shrink-0" />
                    <span className="sr-only">
                      Prefers {order.contactMethod.toLowerCase() || "email"}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    {followUp && order.status !== "rejected" && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        leftIcon={<FiMail aria-hidden />}
                        disabled={!emailConfigured || emailing !== null}
                        loading={emailing === order.orderId}
                        aria-label={`${order.lastEmailedAt ? "Email again" : "Email"} ${name || order.displayEmail}`}
                        title={
                          order.lastEmailedAt
                            ? `Emailed ${new Date(order.lastEmailedAt).toLocaleString()}`
                            : undefined
                        }
                        onClick={() => onEmail(order)}
                      >
                        {order.lastEmailedAt ? "Again" : "Email"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      aria-label={`Review ${name || order.displayEmail}`}
                      onClick={() => onReview(order)}
                    >
                      Review
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
