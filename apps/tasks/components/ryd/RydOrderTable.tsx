import { Fragment, type ReactNode } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiCheck,
  FiChevronDown,
  FiMail,
  FiPhone,
  FiX,
} from "react-icons/fi";
import {
  Button,
  CopyText,
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuItem,
  DropdownMenuItems,
  DropdownMenuSeparator,
} from "@ryanmeetup/ui";
import { rydBuyerMailtoHref } from "@/lib/ryd/emails";
import type { RyanPosition } from "@/lib/ryd/normalize";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import type { RydSort, RydSortKey } from "@/lib/ryd/queue-view";
import {
  prefersPhone,
  rydMatchEvidence,
  RydMatchChip,
  RydRyanPositionChip,
  RydStatusChip,
} from "./RydStatusChip";

type SortChoice = { key: RydSortKey; descending: boolean; label: string };

const both = (
  key: RydSortKey,
  ascending: string,
  descending: string,
): SortChoice[] => [
  { key, descending: false, label: ascending },
  { key, descending: true, label: descending },
];

/** Each column's choices, in groups the menu separates. */
const SORT_CHOICES: Record<
  "name" | "status" | "form" | "ordered",
  SortChoice[][]
> = {
  name: [
    both("name", "A to Z by surname", "Z to A by surname"),
    [
      { key: "ryan", descending: false, label: "First-name Ryans first" },
      {
        key: "middle-name",
        descending: false,
        label: "Middle-name Ryans first",
      },
      { key: "ryan", descending: true, label: "Non-Ryans first" },
    ],
  ],
  status: [both("status", "Pending first", "Rejected first")],
  form: [both("form", "Surest match first", "No submission first")],
  ordered: [both("ordered", "Oldest first", "Newest first")],
};

/**
 * A header that opens its column's sort choices: each one picked outright,
 * or back to the queue's own order. `aria-sort` and the arrow say which is on.
 */
function SortHeader({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: keyof typeof SORT_CHOICES;
  label: string;
  sort: RydSort;
  onSort: (sort: RydSort) => void;
  className: string;
}) {
  const groups = SORT_CHOICES[column].map((group) =>
    group.map((choice) => ({
      ...choice,
      icon: choice.descending ? FiArrowDown : FiArrowUp,
      current:
        sort?.key === choice.key && sort.descending === choice.descending,
    })),
  );
  const active = groups.flat().some((choice) => choice.key === sort?.key);
  // At rest a chevron says the header opens a menu; once sorted, the arrow
  // says which way.
  const Indicator = active
    ? sort?.descending
      ? FiArrowDown
      : FiArrowUp
    : FiChevronDown;
  return (
    <th
      className={className}
      aria-sort={
        active ? (sort?.descending ? "descending" : "ascending") : "none"
      }
    >
      <DropdownMenu>
        <DropdownMenuButton
          unstyled
          aria-label={`Sort by ${label.toLowerCase()}`}
          className={`-mx-1.5 -my-1 inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 font-semibold uppercase tracking-[0.16em] transition hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 data-open:bg-black/5 data-open:text-black dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/50 dark:data-open:bg-white/10 dark:data-open:text-white ${active ? "text-black dark:text-white" : ""}`}
        >
          {label}
          <Indicator
            aria-hidden
            className={`h-3 w-3 shrink-0 ${active ? "" : "opacity-70"}`}
          />
        </DropdownMenuButton>
        <DropdownMenuItems align="start">
          {groups.map((group, index) => (
            <Fragment key={group[0].label}>
              {index > 0 && <DropdownMenuSeparator />}
              {group.map(({ key, descending, label, icon: Icon, current }) => (
                <DropdownMenuItem
                  key={label}
                  onClick={() => onSort({ key, descending })}
                >
                  <Icon aria-hidden className="h-4 w-4 opacity-60" />
                  <span className="flex-1">{label}</span>
                  {current && (
                    <>
                      <FiCheck aria-hidden className="h-4 w-4" />
                      <span className="sr-only">(current)</span>
                    </>
                  )}
                </DropdownMenuItem>
              ))}
            </Fragment>
          ))}
          {active && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSort(null)}>
                <FiX aria-hidden className="h-4 w-4 opacity-60" />
                Clear sort
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuItems>
      </DropdownMenu>
    </th>
  );
}

/**
 * The queue as one dense table, for working down a long list. It carries the
 * same chips and actions as the cards, one row per order.
 */
export function RydOrderTable({
  orders,
  ryanPositions,
  label,
  sort,
  onSort,
  followUp,
  onEmailed,
  onReview,
  footer,
}: {
  orders: RydQueueOrder[];
  ryanPositions: ReadonlyMap<string, RyanPosition | null>;
  label: string;
  sort: RydSort;
  onSort: (sort: RydSort) => void;
  followUp: boolean;
  /** The row's Email opened a draft; record that the buyer was asked. */
  onEmailed: (order: RydQueueOrder) => void;
  onReview: (order: RydQueueOrder) => void;
  /** Sits under the table, inside its border, without scrolling sideways. */
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
      <div className="overflow-x-auto">
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
              <SortHeader
                column="name"
                label="Ryan"
                sort={sort}
                onSort={onSort}
                className="px-4 py-3"
              />
              <SortHeader
                column="status"
                label="Status"
                sort={sort}
                onSort={onSort}
                className="px-3 py-3"
              />
              <SortHeader
                column="form"
                label="Form"
                sort={sort}
                onSort={onSort}
                className="px-3 py-3"
              />
              <SortHeader
                column="ordered"
                label="Order"
                sort={sort}
                onSort={onSort}
                className="px-3 py-3"
              />
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
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        className="block min-w-0 max-w-full truncate text-left font-semibold underline decoration-black/20 underline-offset-4 transition hover:decoration-black focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 dark:decoration-white/25 dark:hover:decoration-white dark:focus-visible:ring-white/70"
                        title={name || order.displayEmail}
                        onClick={() => onReview(order)}
                      >
                        {name || order.displayEmail}
                      </button>
                      <RydRyanPositionChip
                        position={ryanPositions.get(order.orderId)}
                      />
                    </div>
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
                    <CopyText
                      value={order.orderId}
                      label="order number"
                      className="font-semibold tabular-nums text-black dark:text-white"
                    >
                      #{order.orderId}
                    </CopyText>
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
                        <Button.Link
                          href={rydBuyerMailtoHref(
                            order,
                            order.linkedKeys.length > 0,
                          )}
                          size="xs"
                          variant="ghost"
                          leftIcon={<FiMail aria-hidden />}
                          prefetch={false}
                          aria-label={`${order.lastEmailedAt ? "Email again" : "Email"} ${name || order.displayEmail}`}
                          title={
                            order.lastEmailedAt
                              ? `Emailed ${new Date(order.lastEmailedAt).toLocaleString()}`
                              : undefined
                          }
                          onClick={() => onEmailed(order)}
                        >
                          {order.lastEmailedAt ? "Again" : "Email"}
                        </Button.Link>
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
      {footer}
    </div>
  );
}
