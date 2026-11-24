import type { ReactNode } from "react";
import { SortHeader, sortBoth } from "@/components/global";
import type { SortChoice } from "@/components/global";
import { FiAlertTriangle, FiCalendar, FiMail } from "react-icons/fi";
import { Button, CopyText, DropdownSelect, Tooltip } from "@ryanmeetup/ui";
import { formatRydDay } from "@/lib/ryd/form-responses";
import { rydCardComplete, rydCardProblems } from "@/lib/ryd/card";
import {
  canEmailRydOrder,
  rydCardGaps,
  rydSortParam,
  rydSortValue,
} from "@/lib/ryd/queue-view";
import { rydDecisionLocked } from "@/lib/ryd/ryd-decisions";
import type { RyanPosition } from "@/lib/ryd/normalize";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import type { RydSort, RydSortKey } from "@/lib/ryd/queue-view";
import {
  rydMatchEvidence,
  RydMatchChip,
  RydProductionChip,
  RydRyanPositionChip,
  RydStatusChip,
} from "./RydStatusChip";
import { RydEmailLink } from "./RydEmailLink";
import { RydSelectCheckbox } from "./RydSelection";

/** Each column's choices, in groups the menu separates. */
const SORT_CHOICES: Record<
  "name" | "status" | "form" | "ordered" | "production",
  SortChoice<RydSortKey>[][]
> = {
  name: [
    sortBoth("name", "A to Z by surname", "Z to A by surname"),
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
  status: [sortBoth("status", "Pending first", "Cancelled first")],
  form: [sortBoth("form", "Surest match first", "No submission first")],
  ordered: [sortBoth("ordered", "Oldest first", "Newest first")],
  production: [
    sortBoth("production", "Ready to send first", "Done first"),
    sortBoth("production-sent", "Oldest sent first", "Newest sent first"),
  ],
};

/** Column widths; the production view trades Form's room for its own column. */
const COLUMNS = ["w-[24%]", "w-[13%]", "w-[27%]", "w-[18%]", "w-[18%]"];
const SELECT_COLUMNS = [
  "w-10",
  "w-[22%]",
  "w-[12%]",
  "w-[25%]",
  "w-[17%]",
  "w-[20%]",
];
const PRODUCTION_COLUMNS = [
  "w-10",
  "w-[21%]",
  "w-[11%]",
  "w-[21%]",
  "w-[15%]",
  "w-[15%]",
  "w-[13%]",
];

/**
 * The queue as stacked orders in narrow containers and a dense table when
 * there is room for every column. Both layouts share their content and actions.
 * With `selection`,
 * each row gets a checkbox for the bulk actions above the table; `production`
 * adds a Production column, for moving verified orders along.
 */
export function RydOrderTable({
  orders,
  ryanPositions,
  label,
  sort,
  onSort,
  followUp,
  onEmail,
  onReview,
  selection,
  production = false,
  footer,
}: {
  orders: RydQueueOrder[];
  ryanPositions: ReadonlyMap<string, RyanPosition | null>;
  label: string;
  sort: RydSort;
  onSort: (sort: RydSort) => void;
  followUp: boolean;
  /** Open the same explicit draft/confirmation flow used by bulk reminders. */
  onEmail: (order: RydQueueOrder) => void;
  onReview: (order: RydQueueOrder) => void;
  selection?: {
    selected: ReadonlySet<string>;
    onToggle: (orderId: string) => void;
    disabled?: boolean;
  };
  production?: boolean;
  /** Sits under the table, inside its border, without scrolling sideways. */
  footer?: ReactNode;
}) {
  // Both layouts share the same content and handlers; only their arrangement changes.
  const rows = orders.map((order) => {
    const name = `${order.firstName} ${order.lastName}`.trim();
    const { reasons } = rydMatchEvidence(order);
    const cardProblems = rydCardGaps(order);
    // Sent cards are read-only until the order moves back.
    const cardWarning = cardProblems.length
      ? `Card needs ${cardProblems.join(", ")}, so it's left out of card CSVs.${rydDecisionLocked(order) ? " Open the review and unlock the card to finish it." : " Open the review to finish it."}`
      : null;
    return {
      order,
      name,
      identity: (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              className="block min-w-0 max-w-full break-words text-left font-semibold @5xl:truncate underline decoration-black/20 underline-offset-4 transition hover:decoration-black focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 dark:decoration-white/25 dark:hover:decoration-white dark:focus-visible:ring-white/70"
              title={name || order.displayEmail}
              onClick={() => onReview(order)}
            >
              {name || order.displayEmail}
            </button>
            {cardWarning && (
              <Tooltip content={cardWarning}>
                <span
                  role="img"
                  aria-label={cardWarning}
                  className="inline-flex text-amber-600 dark:text-amber-400"
                >
                  <FiCalendar aria-hidden />
                </span>
              </Tooltip>
            )}
            <RydRyanPositionChip position={ryanPositions.get(order.orderId)} />
          </div>
          <RydEmailLink
            email={order.displayEmail}
            className="block break-all text-xs text-black/70 @5xl:truncate dark:text-white/70"
          />
        </>
      ),
      status: (
        <>
          <RydStatusChip status={order.status} />
          {/* Verified before cards existed: nothing approved to print. */}
          {order.status !== "rejected" &&
            !rydDecisionLocked(order) &&
            (!rydCardComplete(order.card) ||
              (order.status === "verified" && !order.cardSaved)) && (
              <span
                className="mt-1 flex items-center gap-1 text-xs text-black/70 @5xl:truncate dark:text-white/70"
                title={
                  rydCardComplete(order.card)
                    ? "Open the review and save the card to approve it for printing"
                    : `Card needs ${rydCardProblems(order.card).join(", ")}`
                }
              >
                <FiAlertTriangle aria-hidden className="shrink-0" />
                {rydCardComplete(order.card)
                  ? "Card not approved"
                  : "Card unfinished"}
              </span>
            )}
          {order.lastEmailedAt && canEmailRydOrder(order) && (
            <span
              className="mt-1 flex items-center gap-1 text-xs text-black/70 @5xl:truncate dark:text-white/70"
              title={`Last contacted ${new Date(order.lastEmailedAt).toLocaleString()}`}
            >
              <FiMail aria-hidden className="shrink-0" />
              Last contacted {formatRydDay(order.lastEmailedAt)}
            </span>
          )}
        </>
      ),
      form: (
        <>
          <RydMatchChip order={order} />
          {reasons.length > 0 && (
            <span
              className="mt-1 block text-xs text-black/70 @5xl:truncate dark:text-white/70"
              title={reasons.join(" · ")}
            >
              {reasons.join(" · ")}
            </span>
          )}
        </>
      ),
      details: (
        <div className="text-xs text-black/70 dark:text-white/70">
          <CopyText
            value={order.orderId}
            label="order number"
            className="font-semibold tabular-nums text-black dark:text-white"
          >
            #{order.orderId}
          </CopyText>
          <span className="block @5xl:truncate">
            {order.orderedAt || "No date"}
          </span>
        </div>
      ),
      actions: (
        <div className="flex gap-2 [&>button]:min-h-10 [&>button]:flex-1 @2xl:justify-end @2xl:[&>button]:flex-none @5xl:[&>button]:min-h-0 @5xl:[&>button]:flex-none">
          {followUp && canEmailRydOrder(order) && (
            <Button
              size="xs"
              variant="ghost"
              leftIcon={<FiMail aria-hidden />}
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
      ),
    };
  });
  const sortOptions = Object.values(SORT_CHOICES)
    .flat(2)
    .map(({ key, descending, label }) => ({
      value: rydSortValue({ key, descending }),
      label,
    }));

  return (
    <div className="@container overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
      <div className="@5xl:hidden">
        <div className="border-b border-black/10 p-4 dark:border-white/10">
          <DropdownSelect
            variant="compact"
            label="Sort orders"
            className="w-full max-w-full justify-start"
            value={rydSortValue(sort)}
            onChange={(value) => onSort(rydSortParam(value))}
            options={[{ value: "", label: "Queue order" }, ...sortOptions]}
          />
        </div>
        <ul
          aria-label={label}
          className="divide-y divide-black/10 dark:divide-white/10"
        >
          {rows.map(
            ({ order, name, identity, status, form, details, actions }) => (
              <li
                key={order.orderId}
                className={`space-y-4 p-4 ${selection?.selected.has(order.orderId) ? "bg-black/[0.035] dark:bg-white/[0.04]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {selection && (
                    <div className="flex min-h-6 shrink-0 items-center">
                      <RydSelectCheckbox
                        label={`Select ${name || order.displayEmail}`}
                        checked={selection.selected.has(order.orderId)}
                        disabled={selection.disabled}
                        onToggle={() => selection.onToggle(order.orderId)}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">{identity}</div>
                </div>
                <dl
                  className={`space-y-3 @2xl:grid @2xl:gap-4 @2xl:space-y-0 ${production ? "@2xl:grid-cols-2" : "@2xl:grid-cols-3"}`}
                >
                  {[
                    { label: "Status", content: status },
                    { label: "Form", content: form },
                    { label: "Order", content: details },
                    ...(production
                      ? [
                          {
                            label: "Progress",
                            content: <RydProductionChip order={order} />,
                          },
                        ]
                      : []),
                  ].map(({ label, content }) => (
                    <div
                      key={label}
                      className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3"
                    >
                      <dt className="pt-0.5 text-xs font-semibold uppercase tracking-caps-tight text-black/70 dark:text-white/70">
                        {label}
                      </dt>
                      <dd className="min-w-0">{content}</dd>
                    </div>
                  ))}
                </dl>
                {actions}
              </li>
            ),
          )}
        </ul>
      </div>
      <div className="hidden @5xl:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">{label}</caption>
          <colgroup>
            {(production
              ? PRODUCTION_COLUMNS.slice(selection ? 0 : 1)
              : selection
                ? SELECT_COLUMNS
                : COLUMNS
            ).map((width, index) => (
              <col key={index} className={width} />
            ))}
          </colgroup>
          <thead className="border-b border-black/10 bg-black/[0.025] text-[10px] uppercase tracking-caps-tight text-black/60 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/60">
            <tr>
              {selection && (
                <th className="py-3 pl-4">
                  <span className="sr-only">Selected</span>
                </th>
              )}
              <SortHeader
                groups={SORT_CHOICES.name}
                label="Ryan"
                sort={sort}
                onSort={onSort}
                className="px-4 py-3"
              />
              <SortHeader
                groups={SORT_CHOICES.status}
                label="Status"
                sort={sort}
                onSort={onSort}
                className="px-3 py-3"
              />
              <SortHeader
                groups={SORT_CHOICES.form}
                label="Form"
                sort={sort}
                onSort={onSort}
                className="px-3 py-3"
              />
              <SortHeader
                groups={SORT_CHOICES.ordered}
                label="Order"
                sort={sort}
                onSort={onSort}
                className="px-3 py-3"
              />
              {production && (
                <SortHeader
                  groups={SORT_CHOICES.production}
                  label="Progress"
                  sort={sort}
                  onSort={onSort}
                  className="px-3 py-3"
                />
              )}
              <th className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {rows.map(
              ({ order, name, identity, status, form, details, actions }) => (
                <tr
                  key={order.orderId}
                  className={`transition hover:bg-black/[0.025] dark:hover:bg-white/[0.025] ${selection?.selected.has(order.orderId) ? "bg-black/[0.035] dark:bg-white/[0.04]" : ""}`}
                >
                  {selection && (
                    <td className="py-2.5 pl-4">
                      <RydSelectCheckbox
                        label={`Select ${name || order.displayEmail}`}
                        checked={selection.selected.has(order.orderId)}
                        disabled={selection.disabled}
                        onToggle={() => selection.onToggle(order.orderId)}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2.5">{identity}</td>
                  <td className="px-3 py-2.5">{status}</td>
                  <td className="px-3 py-2.5">{form}</td>
                  <td className="px-3 py-2.5">{details}</td>
                  {production && (
                    <td className="px-3 py-2.5">
                      <RydProductionChip order={order} />
                    </td>
                  )}
                  <td className="px-4 py-2.5">{actions}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
