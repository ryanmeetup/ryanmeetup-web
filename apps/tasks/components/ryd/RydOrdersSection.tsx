"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useSearchFilter } from "@ryanmeetup/hooks";
import {
  Button,
  ClearFiltersButton,
  ConfirmationDialog,
  DropdownSelect,
  EmptyState,
  Pagination,
  PendingResults,
  SearchInput,
} from "@ryanmeetup/ui";
import { FiCheckSquare, FiMail, FiX } from "react-icons/fi";
import { derivePagination } from "@/lib/pagination";
import { usePagination } from "@/hooks/usePagination";
import { RYD_STATUS_LABELS } from "@/lib/ryd/orders";
import { rydDecisionLocked } from "@/lib/ryd/ryd-decisions";
import type { RydQueue, RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  orderRyanPositions,
  orderSearchText,
  orderSubmissions,
  RYD_STATUS_PARAMS,
  remindableOrders,
  rydSortValue,
  sortRydOrders,
  type RydSort,
  type RydStatusParam,
} from "@/lib/ryd/queue-view";
import {
  RYD_FULFILLMENT_LABELS,
  rydFulfillmentStage,
  type RydFulfillmentStage,
} from "@/lib/ryd/fulfillment-view";
import type { RydProductionAction } from "@/lib/ryd/bulk-operations";
import { RydRemindDialog, RydSendDialog } from "./RydDialogs";
import { RYD_DECISIONS } from "./RydOrderDialog";
import { RydCancelDialog } from "./RydCancelDialog";
import { RydOrderTable } from "./RydOrderTable";
import { RydProductionDialog } from "./RydProductionDialog";
import { RydProductionPanel } from "./RydProductionPanel";
import { RydSelectionBar } from "./RydSelection";
import { useRydSelectionActions } from "./useRydSelectionActions";

const STATUS_OPTIONS = Object.keys(RYD_STATUS_PARAMS).map((value) => {
  const status = RYD_STATUS_PARAMS[value as keyof typeof RYD_STATUS_PARAMS];
  return {
    value,
    label: status ? RYD_STATUS_LABELS[status] : "All open orders",
  };
});

const MOVED_TO: Partial<Record<RydProductionAction, RydFulfillmentStage>> = {
  fulfillment: "sent-to-fulfillment",
  done: "done",
};

/**
 * The order list behind the Orders and Follow-up views: search, the status or
 * fulfillment stage filter, and the bulk actions that fit what's listed.
 */
export function RydOrdersSection({
  view,
  label,
  queue,
  followUp,
  status,
  production,
  sort,
  verifiedCount,
  selected,
  setSelected,
  refreshing,
  refresh,
  reconcile,
  showOlderDone,
  onStatusChange,
  onProductionChange,
  onSortChange,
  onReview,
}: {
  view: "queue" | "follow-up";
  label: string;
  queue: RydQueue;
  followUp: RydQueueOrder[];
  status: RydStatusParam;
  /** Set only in the Verified view. */
  production: RydFulfillmentStage | null;
  sort: RydSort | null;
  verifiedCount: number;
  selected: ReadonlySet<string>;
  setSelected: Dispatch<SetStateAction<ReadonlySet<string>>>;
  refreshing: boolean;
  refresh: () => Promise<void>;
  reconcile: (apply: (current: RydQueue) => RydQueue) => void;
  showOlderDone: () => Promise<void>;
  onStatusChange: (status: RydStatusParam | "") => void;
  onProductionChange: (stage: RydFulfillmentStage | "all" | "") => void;
  onSortChange: (sort: string) => void;
  onReview: (order: RydQueueOrder) => void;
}) {
  const [loadingOlder, setLoadingOlder] = useState(false);
  const producing = view === "queue" && status === "verified";
  const statusFilter = RYD_STATUS_PARAMS[status];
  const remindable = useMemo(() => remindableOrders(followUp), [followUp]);
  const listed = useMemo(
    () =>
      view === "follow-up"
        ? followUp
        : statusFilter
          ? queue.orders.filter(
              (order) =>
                order.status === statusFilter &&
                (!production || rydFulfillmentStage(order) === production),
            )
          : queue.orders,
    [view, followUp, queue.orders, statusFilter, production],
  );
  const {
    query,
    setQuery,
    filtered,
    isPending: searchPending,
  } = useSearchFilter({
    data: listed,
    buildHaystack: orderSearchText,
    queryParam: "search",
  });
  const ryanPositions = useMemo(
    () => orderRyanPositions(queue.orders, queue.submissions),
    [queue.orders, queue.submissions],
  );
  const sorted = useMemo(
    () => sortRydOrders(filtered, sort, ryanPositions),
    [filtered, sort, ryanPositions],
  );
  // Only what's listed counts as selected, so a filter change never acts on
  // rows the reviewer can't see.
  const selectedOrders = useMemo(
    () => sorted.filter((order) => selected.has(order.orderId)),
    [sorted, selected],
  );
  const actions = useRydSelectionActions({
    queue,
    selectedOrders,
    setSelected,
    refresh,
    reconcile,
    onProductionMoved: (action) => {
      const stage = MOVED_TO[action];
      if (stage) onProductionChange(stage);
    },
  });
  const {
    dialog,
    setDialog,
    deciding,
    decisionPending,
    decidable,
    emailableSelected,
    moving,
  } = actions;

  const { page, pageSize, setPage, setPageSize, syncPage } = usePagination();
  const {
    page: currentPage,
    from,
    to,
  } = derivePagination(page, pageSize, sorted.length);
  // Saved changes can empty the last page; land on the one that's left.
  useEffect(() => {
    if (page !== currentPage) syncPage(currentPage);
  }, [currentPage, page, syncPage]);

  function toggleAll() {
    setSelected(
      selectedOrders.length === sorted.length
        ? new Set()
        : new Set(sorted.map((order) => order.orderId)),
    );
  }
  function toggle(orderId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  const emailSelectedButtons = (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full sm:w-auto"
        leftIcon={<FiMail aria-hidden />}
        disabled={searchPending || decisionPending || !emailableSelected.length}
        title={
          selectedOrders.length && !emailableSelected.length
            ? "Only pending and needs-more-info orders with a valid email are emailed."
            : undefined
        }
        onClick={() => setDialog("remind-selected")}
      >
        Email selected
        {selectedOrders.length ? ` (${emailableSelected.length})` : ""}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full sm:w-auto"
        leftIcon={<FiCheckSquare aria-hidden />}
        disabled={searchPending || decisionPending || !emailableSelected.length}
        onClick={() => setDialog("contacted-selected")}
      >
        Mark contacted
      </Button>
    </>
  );
  const cancelSelectedButton = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="w-full sm:w-auto"
      leftIcon={<FiX aria-hidden />}
      disabled={
        searchPending || decisionPending || !decidable("rejected").length
      }
      onClick={() => setDialog("cancel-selected")}
    >
      Cancel orders
    </Button>
  );

  const decidingOrders = deciding ? decidable(deciding) : [];
  const decidingUnfinished = deciding
    ? actions.unfinishedCards(deciding).length
    : 0;
  const decidingSkipped = deciding
    ? selectedOrders.filter(rydDecisionLocked).length
    : 0;
  const decidingBare =
    deciding === "verified"
      ? decidingOrders.filter(
          (order) =>
            !orderSubmissions(order, queue.submissions).submissions.length,
        ).length
      : 0;
  const decisionLabel = RYD_DECISIONS.find((d) => d.status === deciding)?.label;

  return (
    <>
      <section aria-busy={refreshing} aria-label={label} className="space-y-4">
        {view === "follow-up" && followUp.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-black/70 dark:text-white/70">
              Orders asked for more, or with nothing on the form. Email opens a
              draft asking the buyer for their ry-dentification. Anyone who
              never verifies can be selected and cancelled.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full shrink-0 sm:w-auto"
              leftIcon={<FiMail aria-hidden />}
              onClick={() => setDialog("remind")}
              disabled={searchPending || !remindable.length}
              title={
                remindable.length
                  ? undefined
                  : "Everyone here was emailed in the last day."
              }
            >
              Email everyone ({remindable.length})
            </Button>
          </div>
        )}
        <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-3 bg-white px-1 pb-3 sm:flex-row sm:items-stretch dark:bg-[#181818]">
          <div className="min-w-0 flex-1">
            <SearchInput
              label="Search orders"
              name="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by Ryan, email, or order number..."
              pending={searchPending}
              pendingLabel="Loading order results"
            />
          </div>
          {view === "queue" && (
            <DropdownSelect
              variant="compact"
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={(value) => {
                onStatusChange(
                  value === "pending" ? "" : (value as RydStatusParam),
                );
                onProductionChange("");
                setPage(1);
              }}
            />
          )}
          {(query || sort || (view === "queue" && status !== "pending")) && (
            <ClearFiltersButton
              className="self-start sm:self-center"
              onClick={() => {
                setQuery("");
                onStatusChange("");
                onProductionChange("");
                onSortChange("");
                setPage(1);
              }}
            />
          )}
        </div>
        {producing && (
          <RydProductionPanel
            queue={queue}
            stage={production}
            verifiedCount={verifiedCount}
            listed={sorted}
            selectedOrders={selectedOrders}
            actions={actions}
            disabled={searchPending}
            loadingOlder={loadingOlder}
            onStageChange={(stage) => {
              onProductionChange(stage ?? "all");
              setPage(1);
            }}
            onShowOlder={() => {
              setLoadingOlder(true);
              showOlderDone()
                .catch(() => {})
                .finally(() => setLoadingOlder(false));
            }}
            onToggleAll={toggleAll}
            onPulled={refresh}
          />
        )}
        {view === "queue" && !producing && sorted.length > 0 && (
          <RydSelectionBar
            total={sorted.length}
            selectedCount={selectedOrders.length}
            disabled={searchPending || decisionPending}
            onToggleAll={toggleAll}
          >
            {statusFilter !== "rejected" && emailSelectedButtons}
            {statusFilter !== "rejected" && cancelSelectedButton}
            {RYD_DECISIONS.filter(
              (decision) =>
                decision.status !== statusFilter &&
                decision.status !== "rejected",
            ).map(({ status: target, label, icon: Icon }) => (
              <Button
                key={target}
                type="button"
                size="sm"
                variant={target === "verified" ? "primary" : "secondary"}
                className="w-full sm:w-auto"
                leftIcon={<Icon aria-hidden />}
                disabled={
                  searchPending || decisionPending || !decidable(target).length
                }
                onClick={() => actions.setDeciding(target)}
              >
                {label}
              </Button>
            ))}
          </RydSelectionBar>
        )}
        {view === "follow-up" && sorted.length > 0 && (
          <RydSelectionBar
            total={sorted.length}
            selectedCount={selectedOrders.length}
            disabled={searchPending}
            onToggleAll={toggleAll}
          >
            {emailSelectedButtons}
            {cancelSelectedButton}
          </RydSelectionBar>
        )}
        <PendingResults pending={searchPending} label="Loading orders">
          {filtered.length === 0 ? (
            <EmptyState
              className="py-12"
              message={
                !queue.orders.length
                  ? "No orders yet. Upload this week's file from fulfillment to start."
                  : query
                    ? "No orders match that search."
                    : view === "follow-up"
                      ? "Nobody to chase right now."
                      : production
                        ? `No verified orders are ${RYD_FULFILLMENT_LABELS[production].toLowerCase()}.`
                        : "No orders with that status."
              }
            />
          ) : (
            <RydOrderTable
              orders={sorted.slice(from, to + 1)}
              ryanPositions={ryanPositions}
              label={label}
              sort={sort}
              onSort={(next) => {
                onSortChange(rydSortValue(next));
                setPage(1);
              }}
              followUp={view === "follow-up"}
              onEmail={actions.setEmailOrder}
              onReview={onReview}
              production={producing}
              selection={{
                selected,
                onToggle: toggle,
                disabled: searchPending || moving !== null,
              }}
              footer={
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  totalCount={sorted.length}
                  itemLabel="orders"
                  disabled={searchPending}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              }
            />
          )}
        </PendingResults>
      </section>

      <ConfirmationDialog
        open={deciding !== null}
        setOpen={(open) => {
          if (!open && !decisionPending) actions.setDeciding(null);
        }}
        title={
          deciding
            ? `${decisionLabel} ${decidingOrders.length} order${decidingOrders.length === 1 ? "" : "s"}?`
            : ""
        }
        description={
          deciding
            ? [
                deciding === "verified"
                  ? "Each one is cleared for fulfillment, and any suggested form response is linked to it."
                  : `Each one is marked ${RYD_STATUS_LABELS[deciding].toLowerCase()}.`,
                decidingBare
                  ? `${decidingBare} ha${decidingBare === 1 ? "s" : "ve"} nothing on the form.`
                  : "",
                decidingUnfinished
                  ? `${decidingUnfinished} with an unfinished card ${decidingUnfinished === 1 ? "stays" : "stay"} selected. Finish each card in its review to verify it.`
                  : "",
                decidingSkipped
                  ? `${decidingSkipped} already with fulfillment or in production ${decidingSkipped === 1 ? "is" : "are"} left alone.`
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
            : undefined
        }
        confirmLabel={decisionLabel ?? "Confirm"}
        pendingLabel="Saving..."
        pending={decisionPending}
        onConfirm={() => deciding && actions.decideSelected(deciding)}
      />
      {dialog === "cancel-selected" && (
        <RydCancelDialog
          orders={decidable("rejected")}
          fulfillmentEmail={queue.settings.fulfillmentEmail}
          onConfirm={async () => {
            await actions.decideSelected("rejected");
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "send" && actions.fulfillmentOrderIds && (
        <RydSendDialog
          orderIds={actions.fulfillmentOrderIds}
          onClose={() => setDialog(null)}
        />
      )}
      {actions.emailOrder && (
        <RydRemindDialog
          orders={[actions.emailOrder]}
          title={`Email ${actions.emailOrder.firstName || "buyer"}`}
          onClose={() => actions.setEmailOrder(null)}
          onChanged={refresh}
        />
      )}
      {(dialog === "remind" ||
        dialog === "remind-selected" ||
        dialog === "contacted-selected") && (
        <RydRemindDialog
          {...(dialog === "contacted-selected"
            ? {
                orders: emailableSelected,
                draft: false,
                title: `Mark ${emailableSelected.length} contacted`,
              }
            : dialog === "remind-selected"
              ? {
                  orders: emailableSelected,
                  title: `Email ${emailableSelected.length} selected`,
                }
              : { orders: remindable })}
          onClose={() => setDialog(null)}
          onChanged={async () => {
            await refresh();
            setSelected(new Set());
          }}
        />
      )}
      {actions.productionOperation && (
        <RydProductionDialog
          orders={actions.productionOperation.orders}
          action={actions.productionOperation.action}
          onApplied={actions.productionApplied}
          onClose={actions.closeProduction}
        />
      )}
    </>
  );
}
