"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";
import {
  Button,
  DropdownSelect,
  EmptyState,
  FilterChip,
  ManagementSurface,
  PendingResults,
  SearchInput,
  toast,
} from "@ryanmeetup/ui";
import type { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiInbox,
  FiGrid,
  FiList,
  FiPhoneOutgoing,
  FiSend,
  FiSettings,
  FiShoppingBag,
  FiUpload,
} from "react-icons/fi";
import {
  CountBadge,
  MetricLinkCard,
  WorkspacePageShell,
} from "@/components/global";
import { mutate, parseMutationResponse } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { RYD_STATUS_LABELS, type RydOrderStatus } from "@/lib/ryd/orders";
import type { RydQueue, RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  followUpOrders,
  claimedElsewhere,
  orderSearchText,
  RYD_STATUS_PARAMS,
  nextRydSort,
  rydCounts,
  rydSortParam,
  rydSortValue,
  sortRydOrders,
  type RydStatusParam,
  rydStatusParam,
  rydView,
  unmatchedSubmitters,
  type RydView,
} from "@/lib/ryd/queue-view";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import {
  RydSendDialog,
  RydSettingsDialog,
  RydUploadDialog,
} from "./RydDialogs";
import { RydOrderDialog } from "./RydOrderDialog";
import { RydOrderCard } from "./RydOrderCard";
import { RydOrderTable } from "./RydOrderTable";
import { RYD_STATUS_ICONS, RYD_STATUS_TONES } from "./RydStatusChip";
import { RydSubmissionCard } from "./RydSubmissionCard";

const GOOGLE_MESSAGES: Record<string, [ok: boolean, message: string]> = {
  connected: [true, "Google connected. The form's answers are in."],
  scopes: [
    false,
    "Google connected without every permission. Reconnect and leave all the boxes ticked.",
  ],
  "refresh-token": [
    false,
    "Google didn't hand over a lasting sign-in. Remove the app from your Google account's connections and connect again.",
  ],
  unavailable: [false, "Google sign-in isn't configured on this instance."],
  invalid: [false, "That Google sign-in expired. Try connecting again."],
  auth: [false, "Only an owner can connect Google."],
  failed: [false, "Google couldn't be connected. Try again."],
};

const VIEW_LABELS: Record<RydView, string> = {
  queue: "Orders",
  "follow-up": "Follow-up",
  unmatched: "Unmatched submissions",
};

const VIEW_ICONS: Record<RydView, IconType> = {
  queue: FiShoppingBag,
  "follow-up": FiPhoneOutgoing,
  unmatched: FiInbox,
};

const LAYOUTS = [
  { value: "table", label: "Table", icon: FiList },
  { value: "cards", label: "Cards", icon: FiGrid },
] as const;

/** The stat cards double as the status filter, in this order. */
const STAT_CARDS: {
  status: RydOrderStatus;
  param: RydStatusParam;
  label: string;
  mobileLabel: string;
}[] = [
  {
    status: "pending",
    param: "pending",
    label: RYD_STATUS_LABELS.pending,
    mobileLabel: "Pending",
  },
  {
    status: "needs_info",
    param: "needs-info",
    label: RYD_STATUS_LABELS.needs_info,
    mobileLabel: "Needs info",
  },
  {
    status: "verified",
    param: "verified",
    label: "Verified, not sent",
    mobileLabel: "Verified",
  },
  {
    status: "rejected",
    param: "rejected",
    label: RYD_STATUS_LABELS.rejected,
    mobileLabel: "Rejected",
  },
];

const STATUS_OPTIONS = Object.keys(RYD_STATUS_PARAMS).map((value) => {
  const status = RYD_STATUS_PARAMS[value as keyof typeof RYD_STATUS_PARAMS];
  return {
    value,
    label: status ? RYD_STATUS_LABELS[status] : "All open orders",
  };
});

type Dialog = "upload" | "send" | "settings" | null;

export function RydPageClient({
  initialData,
  initialQueue,
  isOwner,
  googleConfigured,
  emailConfigured,
}: {
  initialData: WorkspaceData;
  initialQueue: RydQueue;
  isOwner: boolean;
  googleConfigured: boolean;
  emailConfigured: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [queue, setQueue] = useState(initialQueue);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [viewParam, setViewParam] = useQueryParamState("view");
  const [statusParam, setStatusParam] = useQueryParamState("status");
  const [layoutParam, setLayoutParam] = useQueryParamState("layout");
  const [sortParam, setSortParam] = useQueryParamState("sort");
  const [openOrderId, setOpenOrderId] = useQueryParamState("order");
  const [googleParam, setGoogleParam] = useQueryParamState("google");
  const [emailing, setEmailing] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const view = rydView(viewParam);
  const status = rydStatusParam(statusParam);
  const layout = layoutParam === "cards" ? "cards" : "table";
  const sort = rydSortParam(sortParam);

  // Clicking a card shows that status; clicking it again shows every order.
  function filterByStatus(param: RydStatusParam) {
    const next = view === "queue" && status === param ? "all" : param;
    setViewParam("");
    setStatusParam(next === "pending" ? "" : next);
  }

  const refresh = useCallback(async () => {
    const response = await fetch("/api/ryd", { cache: "no-store" });
    setQueue(await parseMutationResponse<RydQueue>(response));
  }, []);

  // The OAuth callback lands back here with its outcome in the query string.
  useEffect(() => {
    const outcome = GOOGLE_MESSAGES[googleParam];
    if (!outcome) return;
    if (outcome[0]) toast.success(outcome[1]);
    else toast.error(outcome[1]);
    setGoogleParam("");
  }, [googleParam, setGoogleParam]);

  const counts = useMemo(() => rydCounts(queue.orders), [queue.orders]);
  const followUp = useMemo(() => followUpOrders(queue), [queue]);
  const unmatched = useMemo(() => unmatchedSubmitters(queue), [queue]);
  const statusFilter = RYD_STATUS_PARAMS[status];
  const listed = useMemo(
    () =>
      view === "follow-up"
        ? followUp
        : statusFilter
          ? queue.orders.filter((order) => order.status === statusFilter)
          : queue.orders,
    [view, followUp, queue.orders, statusFilter],
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
  const sorted = useMemo(() => sortRydOrders(filtered, sort), [filtered, sort]);
  const openOrder = queue.orders.find((order) => order.orderId === openOrderId);
  const orderOptions = useMemo(
    () =>
      queue.orders.map((order) => ({
        value: order.orderId,
        label: `${order.firstName} ${order.lastName} · ${order.displayEmail} · ${order.orderId}`,
      })),
    [queue.orders],
  );

  async function emailBuyer(order: RydQueueOrder) {
    setEmailing(order.orderId);
    try {
      await mutate(
        `/api/ryd/orders/${encodeURIComponent(order.orderId)}/email`,
        {
          method: "POST",
          body: "{}",
        },
      );
      await refresh();
      toast.success(`Emailed ${order.displayEmail}.`);
    } catch (error) {
      toast.error(errorMessage(error, "The email couldn't be sent."));
    } finally {
      setEmailing(null);
    }
  }

  async function linkSubmitter(email: string, orderId: string) {
    setLinking(email);
    try {
      for (const submission of queue.submissions.filter(
        (s) => s.email === email,
      ))
        await mutate(`/api/ryd/orders/${encodeURIComponent(orderId)}/links`, {
          method: "POST",
          body: JSON.stringify({
            submissionKey: submission.key,
            source: "manual",
          }),
        });
      await refresh();
      toast.success("Linked. Review the order to decide.");
      setOpenOrderId(orderId);
    } catch (error) {
      toast.error(errorMessage(error, "That submission couldn't be linked."));
    } finally {
      setLinking(null);
    }
  }

  const sheetNotice =
    queue.sheet.status === "ok"
      ? null
      : queue.sheet.status === "error"
        ? queue.sheet.message
        : queue.sheet.status === "unconfigured"
          ? "Add the RY-dentification form in RY-D settings to see what buyers sent."
          : isOwner
            ? "Connect the Google account that owns the RY-dentification form to see what buyers sent."
            : "An owner needs to connect the RY-dentification form before submissions show up here.";

  return (
    <>
      <WorkspacePageShell
        data={data}
        setData={setData}
        demoMode={false}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        contentClassName="p-3 sm:p-6 lg:p-6 xl:p-8"
      >
        <ManagementSurface
          title={
            <>
              RY-D verification{" "}
              <CountBadge size="lg">{queue.orders.length}</CountBadge>
            </>
          }
          description="Match each RY-D order to what the buyer sent the RY-dentification form, decide, then send fulfillment the orders they can start."
          actions={
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                leftIcon={<FiUpload aria-hidden />}
                onClick={() => setDialog("upload")}
                disabled={!queue.installed}
              >
                Upload orders
              </Button>
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                leftIcon={<FiSend aria-hidden />}
                onClick={() => setDialog("send")}
                disabled={!queue.installed || !queue.orders.length}
              >
                Send to fulfillment
              </Button>
              {isOwner && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full sm:w-auto"
                  leftIcon={<FiSettings aria-hidden />}
                  onClick={() => setDialog("settings")}
                  disabled={!queue.installed}
                >
                  Settings
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-6">
            {!queue.installed && (
              <p className="flex items-start gap-2 rounded-2xl border border-black/10 p-4 text-sm dark:border-white/10">
                <FiAlertTriangle aria-hidden className="mt-0.5 shrink-0" />
                This database doesn&apos;t have the RY-D tables yet. Apply the
                pending migration, then reload.
              </p>
            )}
            {queue.installed && sheetNotice && (
              <div className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <p className="flex items-start gap-2">
                  <FiAlertTriangle aria-hidden className="mt-0.5 shrink-0" />
                  {sheetNotice}
                </p>
                {isOwner && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => setDialog("settings")}
                  >
                    Open settings
                  </Button>
                )}
              </div>
            )}

            <div
              className="grid grid-cols-2 gap-3 lg:grid-cols-4"
              role="group"
              aria-label="Filter by status"
            >
              {STAT_CARDS.map((card) => {
                const Icon = RYD_STATUS_ICONS[card.status];
                return (
                  <MetricLinkCard
                    key={card.status}
                    icon={<Icon aria-hidden />}
                    label={card.label}
                    mobileLabel={card.mobileLabel}
                    tone={RYD_STATUS_TONES[card.status]}
                    value={counts[card.status]}
                    active={view === "queue" && status === card.param}
                    onClick={() => filterByStatus(card.param)}
                  />
                );
              })}
            </div>
            {queue.lastBatch && (
              <p className="text-sm text-black/70 dark:text-white/70">
                Last sent {new Date(queue.lastBatch.sentAt).toLocaleString()}
                {queue.lastBatch.recipient
                  ? ` to ${queue.lastBatch.recipient}`
                  : ""}
                : {queue.lastBatch.verifiedCount} of{" "}
                {queue.lastBatch.orderCount} cleared. {queue.clearedCount} order
                {queue.clearedCount === 1 ? "" : "s"} cleared so far.
              </p>
            )}

            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="View"
            >
              {(Object.keys(VIEW_LABELS) as RydView[]).map((key) => {
                const Icon = VIEW_ICONS[key];
                return (
                  <FilterChip
                    key={key}
                    active={view === key}
                    onClick={() => setViewParam(key === "queue" ? "" : key)}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Icon aria-hidden className="h-3 w-3" />
                    {VIEW_LABELS[key]}{" "}
                    {key === "follow-up"
                      ? followUp.length
                      : key === "unmatched"
                        ? unmatched.length
                        : ""}
                  </FilterChip>
                );
              })}
            </div>

            {view === "unmatched" ? (
              <section aria-label="Unmatched submissions" className="space-y-4">
                <p className="text-sm text-black/70 dark:text-white/70">
                  Form answers no order has claimed: often a gift, a different
                  email, or an order that hasn&apos;t arrived in a file yet.
                </p>
                {unmatched.length === 0 ? (
                  <EmptyState
                    className="py-12"
                    message={
                      queue.sheet.status === "ok"
                        ? "Every form submission is paired with an order."
                        : "No form submissions to show."
                    }
                  />
                ) : (
                  <div className="grid items-start gap-4 2xl:grid-cols-2">
                    {unmatched.map((submitter) => (
                      <div key={submitter.email} className="space-y-3">
                        {submitter.submissions.map((submission) => (
                          <RydSubmissionCard
                            key={submission.key}
                            submission={submission}
                          />
                        ))}
                        <DropdownSelect
                          variant="compact"
                          label="Link to order"
                          options={orderOptions}
                          value=""
                          onChange={(orderId) =>
                            linkSubmitter(submitter.email, orderId)
                          }
                          searchPlaceholder="Search orders"
                          disabled={linking !== null || !orderOptions.length}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section aria-label={VIEW_LABELS[view]} className="space-y-4">
                <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-3 bg-white px-1 pb-3 sm:flex-row sm:items-stretch dark:bg-[#181818]">
                  <div className="min-w-0 flex-1">
                    <SearchInput
                      label="Search orders"
                      name="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by Ryan, email, or order number..."
                      pending={searchPending}
                      pendingLabel="Loading order results"
                    />
                  </div>
                  <div
                    role="group"
                    aria-label="Layout"
                    className="flex shrink-0 self-start rounded-lg border border-black/10 p-0.5 sm:self-stretch dark:border-white/10"
                  >
                    {LAYOUTS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={layout === value}
                        onClick={() =>
                          setLayoutParam(value === "table" ? "" : value)
                        }
                        className={`view-button py-1.5 [&_svg]:size-4 ${layout === value ? "view-button-active" : ""}`}
                      >
                        <Icon aria-hidden /> {label}
                      </button>
                    ))}
                  </div>
                  {view === "queue" && (
                    <DropdownSelect
                      variant="compact"
                      label="Status"
                      options={STATUS_OPTIONS}
                      value={status}
                      onChange={(value) =>
                        setStatusParam(value === "pending" ? "" : value)
                      }
                    />
                  )}
                </div>
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
                              : "No orders with that status."
                      }
                    />
                  ) : layout === "table" ? (
                    <RydOrderTable
                      orders={sorted}
                      label={VIEW_LABELS[view]}
                      sort={sort}
                      onSort={(column) =>
                        setSortParam(rydSortValue(nextRydSort(sort, column)))
                      }
                      followUp={view === "follow-up"}
                      emailConfigured={emailConfigured}
                      emailing={emailing}
                      onEmail={emailBuyer}
                      onReview={(order) => setOpenOrderId(order.orderId)}
                    />
                  ) : (
                    <ul className="grid gap-3 xl:grid-cols-2">
                      {sorted.map((order) => (
                        <RydOrderCard
                          key={order.orderId}
                          order={order}
                          followUp={view === "follow-up"}
                          emailConfigured={emailConfigured}
                          emailing={emailing}
                          onEmail={() => emailBuyer(order)}
                          onReview={() => setOpenOrderId(order.orderId)}
                        />
                      ))}
                    </ul>
                  )}
                </PendingResults>
              </section>
            )}
          </div>
        </ManagementSurface>
      </WorkspacePageShell>

      {openOrder && (
        <RydOrderDialog
          key={openOrder.orderId}
          order={openOrder}
          submissions={queue.submissions}
          claimedKeys={claimedElsewhere(queue.orders, openOrder.orderId)}
          emailConfigured={emailConfigured}
          onClose={() => setOpenOrderId("")}
          onChanged={refresh}
        />
      )}
      {dialog === "upload" && (
        <RydUploadDialog onClose={() => setDialog(null)} onChanged={refresh} />
      )}
      {dialog === "send" && (
        <RydSendDialog
          queue={queue}
          emailConfigured={emailConfigured}
          onClose={() => setDialog(null)}
          onChanged={refresh}
        />
      )}
      {dialog === "settings" && (
        <RydSettingsDialog
          queue={queue}
          googleConfigured={googleConfigured}
          onClose={() => setDialog(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}
