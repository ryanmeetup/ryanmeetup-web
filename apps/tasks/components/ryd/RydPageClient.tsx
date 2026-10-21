"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";
import {
  Button,
  ClearFiltersButton,
  ConfirmationDialog,
  DropdownSelect,
  EmptyState,
  FilterChip,
  ManagementSurface,
  Pagination,
  PendingResults,
  SearchInput,
  toast,
} from "@ryanmeetup/ui";
import type { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheckSquare,
  FiCornerUpLeft,
  FiHash,
  FiInbox,
  FiMail,
  FiPackage,
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
import { usePagination } from "@/hooks/usePagination";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { RYD_STATUS_LABELS, type RydOrderStatus } from "@/lib/ryd/orders";
import type { RydSubmission, RydSubmitter } from "@/lib/ryd/matching";
import { isRydContactEmail } from "@/lib/ryd/normalize";
import type { RydQueue, RydQueueOrder } from "@/lib/ryd/queue-types";
import {
  followUpOrders,
  claimedElsewhere,
  linkableOrders,
  orderSearchText,
  RYD_STATUS_PARAMS,
  rydCounts,
  orderRyanPositions,
  rydSortParam,
  rydSortValue,
  sortRydOrders,
  type RydStatusParam,
  rydStatusParam,
  rydView,
  RYD_PRODUCTION_LABELS,
  RYD_PRODUCTION_STAGES,
  rydProductionCounts,
  rydProductionParam,
  rydProductionStage,
  unsentOrders,
  contactableSubmitters,
  remindableOrders,
  unmatchedSubmitters,
  type RydView,
} from "@/lib/ryd/queue-view";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import {
  RydRemindDialog,
  RydSendDialog,
  RydSettingsDialog,
  RydUploadDialog,
} from "./RydDialogs";
import { RydOrderDialog } from "./RydOrderDialog";
import { RydOrderTable } from "./RydOrderTable";
import { RydSelectionBar } from "./RydSelection";
import { RydContactDialog } from "./RydContactDialog";
import { RydProductionDialog } from "./RydProductionDialog";
import { useRydQueueController } from "./useRydQueueController";
import {
  RYD_BULK_LIMIT,
  RYD_BULK_BODY_BYTES,
  rydBodyBytes,
  type RydProductionAction,
  type RydProductionResult,
  type RydContactResult,
} from "@/lib/ryd/bulk-operations";
import {
  RYD_PRODUCTION_ICONS,
  RYD_STATUS_ICONS,
  RYD_STATUS_TEXT,
  RYD_STATUS_TONES,
} from "./RydStatusChip";
import { RydUnmatchedLayoutToggle, RydUnmatchedView } from "./RydUnmatchedView";

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
  auth: [false, "You need RY-D access to connect Google."],
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
    label: RYD_STATUS_LABELS.verified,
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

type Dialog =
  | "upload"
  | "send"
  | "remind"
  | "remind-selected"
  | "unmatched-email"
  | "unmatched-email-selected"
  | "settings"
  | null;

export function RydPageClient({
  initialData,
  initialQueue,
  googleConfigured,
}: {
  initialData: WorkspaceData;
  initialQueue: RydQueue;
  googleConfigured: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { queue, refresh, reconcile } = useRydQueueController(initialQueue);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [viewParam, setViewParam] = useQueryParamState("view");
  const [statusParam, setStatusParam] = useQueryParamState("status");
  const [sortParam, setSortParam] = useQueryParamState("sort");
  const [layoutParam, setLayoutParam] = useQueryParamState("layout");
  const [openOrderId, setOpenOrderId] = useQueryParamState("order");
  const [googleParam, setGoogleParam] = useQueryParamState("google");
  const [linking, setLinking] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RydSubmission | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [contactOperation, setContactOperation] = useState<string[] | null>(
    null,
  );
  const contacting = contactOperation ? "*" : null;
  const [productionParam, setProductionParam] =
    useQueryParamState("production");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectedSubmitterKeys, setSelectedSubmitterKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [emailOrder, setEmailOrder] = useState<RydQueueOrder | null>(null);
  const [productionOperation, setProductionOperation] = useState<{
    action: RydProductionAction;
    orders: RydQueueOrder[];
  } | null>(null);
  const moving = productionOperation?.action ?? null;
  const view = rydView(viewParam);
  const status = rydStatusParam(statusParam);
  // Verified orders get checkboxes, to move them through production in bulk;
  // Follow-up's, to email just some of the buyers.
  const producing = view === "queue" && status === "verified";
  const selectable = producing || view === "follow-up";
  const production = producing ? rydProductionParam(productionParam) : null;
  const sort = rydSortParam(sortParam);
  const unmatchedLayout = layoutParam === "table" ? "table" : "cards";
  const { page, pageSize, setPage, setPageSize, syncPage } = usePagination();

  // Clicking a card shows that status; clicking it again shows every order.
  function filterByStatus(param: RydStatusParam) {
    const next = view === "queue" && status === param ? "all" : param;
    setViewParam("");
    setStatusParam(next === "pending" ? "" : next);
    setProductionParam("");
    setPage(1);
  }

  // The OAuth callback lands back here with its outcome in the query string.
  useEffect(() => {
    const outcome = GOOGLE_MESSAGES[googleParam];
    if (!outcome) return;
    if (outcome[0]) toast.success(outcome[1]);
    else toast.error(outcome[1]);
    setGoogleParam("");
  }, [googleParam, setGoogleParam]);

  const counts = useMemo(() => rydCounts(queue.orders), [queue.orders]);
  const productionCounts = useMemo(
    () => rydProductionCounts(queue.orders),
    [queue.orders],
  );
  const unsent = useMemo(() => unsentOrders(queue.orders), [queue.orders]);
  // Finished all round: fulfillment has been told and the RY-D is made.
  const activeCount = queue.orders.filter(
    (order) => !(order.doneAt && order.sentToFulfillment),
  ).length;
  const followUp = useMemo(() => followUpOrders(queue), [queue]);
  const unmatched = useMemo(() => unmatchedSubmitters(queue), [queue]);
  const selectableSubmitters = useMemo(
    () => unmatched.filter((submitter) => isRydContactEmail(submitter.email)),
    [unmatched],
  );

  const contactable = useMemo(
    () => contactableSubmitters(unmatched, queue.contacts),
    [unmatched, queue.contacts],
  );
  const remindable = useMemo(() => remindableOrders(followUp), [followUp]);
  const statusFilter = RYD_STATUS_PARAMS[status];
  const listed = useMemo(
    () =>
      view === "follow-up"
        ? followUp
        : statusFilter
          ? queue.orders.filter(
              (order) =>
                order.status === statusFilter &&
                (!production || rydProductionStage(order) === production),
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
    () =>
      selectable ? sorted.filter((order) => selected.has(order.orderId)) : [],
    [selectable, sorted, selected],
  );
  const selectedSubmitters = useMemo(
    () =>
      view === "unmatched"
        ? selectableSubmitters.filter((submitter) => selectedSubmitterKeys.has(submitter.key))
        : [],
    [view, selectableSubmitters, selectedSubmitterKeys],
  );
  // Ticked by hand overrides the day's pause, but a rejected order is never
  // emailed.
  const emailableSelected = selectedOrders.filter(
    (order) => order.status !== "rejected" && order.email,
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageOrders = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // Deciding orders can empty the last page; land on the one that's left.
  useEffect(() => {
    if (page !== currentPage) syncPage(currentPage);
  }, [currentPage, page, syncPage]);
  const pagination = (
    <Pagination
      page={currentPage}
      pageSize={pageSize}
      totalCount={sorted.length}
      itemLabel="orders"
      disabled={searchPending}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
    />
  );
  const openOrder = queue.orders.find((order) => order.orderId === openOrderId);
  const orderOptions = useMemo(
    () =>
      linkableOrders(queue.orders).map((order) => {
        const StatusIcon = RYD_STATUS_ICONS[order.status];
        return {
          value: order.orderId,
          label:
            `${order.firstName} ${order.lastName}`.trim() || order.displayEmail,
          group: {
            icon: <StatusIcon aria-hidden className="h-3 w-3" />,
            label: RYD_STATUS_LABELS[order.status],
            textClassName: RYD_STATUS_TEXT[order.status],
          },
          details: [
            { icon: <FiMail aria-hidden />, text: order.displayEmail },
            { icon: <FiHash aria-hidden />, text: order.orderId },
            ...(order.orderedAt
              ? [{ icon: <FiCalendar aria-hidden />, text: order.orderedAt }]
              : []),
          ].filter((detail) => detail.text),
        };
      }),
    [queue.orders],
  );

  function toggleIn(setter: typeof setSelected): (value: string) => void {
    return (value) =>
      setter((current) => {
        const next = new Set(current);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
  }
  const toggleSelected = toggleIn(setSelected);
  const toggleSubmitter = toggleIn(setSelectedSubmitterKeys);

  function moveSelected(action: RydProductionAction) {
    if (searchPending || moving !== null) return;
    setProductionOperation({ action, orders: selectedOrders });
  }

  function productionApplied(result: RydProductionResult) {
    const saved = new Map(result.orders.map((order) => [order.orderId, order]));
    reconcile((current) => ({
      ...current,
      orders: current.orders.map((order) => ({
        ...order,
        ...saved.get(order.orderId),
      })),
    }));
    setSelected(
      (current) => new Set([...current].filter((id) => !saved.has(id))),
    );
  }

  function contactsRecorded(result: RydContactResult) {
    reconcile((current) => ({
      ...current,
      contacts: { ...current.contacts, ...result.contacts },
    }));
    const saved = new Set(
      Object.keys(result.contacts).map((email) => `email:${email}`),
    );
    setSelectedSubmitterKeys(
      (current) => new Set([...current].filter((key) => !saved.has(key))),
    );
  }

  const selectedStages = new Set(selectedOrders.map(rydProductionStage));

  function toggleAllOrders() {
    setSelected(
      selectedOrders.length === sorted.length
        ? new Set()
        : new Set(sorted.map((order) => order.orderId)),
    );
  }

  async function linkSubmitter(submitter: RydSubmitter, orderId: string) {
    if (searchPending || linking !== null) return;
    const submissionKeys = [
      ...new Set(submitter.submissions.map((submission) => submission.key)),
    ];
    const payload = { submissionKeys, source: "manual" };
    if (
      submissionKeys.length > RYD_BULK_LIMIT ||
      rydBodyBytes(payload) > RYD_BULK_BODY_BYTES
    ) {
      toast.error(
        "This person has too many responses to link together. Link individual responses from the order review.",
      );
      setOpenOrderId(orderId);
      return;
    }
    setLinking(submitter.key);
    try {
      await mutate(`/api/ryd/orders/${encodeURIComponent(orderId)}/links`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Linked. Review the order to decide.");
      setOpenOrderId(orderId);
      try {
        await refresh();
      } catch {
        toast.error(
          "The responses were linked, but the queue could not reload. Refresh the page to see them.",
        );
      }
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          "Those responses couldn't be linked. Nothing was partially linked.",
        ),
      );
    } finally {
      setLinking(null);
    }
  }

  function markContacted(emails: string[]) {
    if (searchPending || contacting !== null) return;
    setContactOperation(emails);
  }

  /** Remove a response from the queue, or with `restore`, put it back. */
  async function setDismissed(submission: RydSubmission, restore = false) {
    setDismissing(submission.key);
    try {
      await mutate("/api/ryd/dismissals", {
        method: restore ? "DELETE" : "POST",
        body: JSON.stringify({ submissionKey: submission.key }),
      });
      await refresh();
      setRemoving(null);
      toast.success(
        restore
          ? "Response restored."
          : "Response removed. It stays in the Google Form.",
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          restore
            ? "That response couldn't be restored."
            : "That response couldn't be removed.",
        ),
      );
    } finally {
      setDismissing(null);
    }
  }

  const sheetNotice =
    queue.sheet.status === "ok"
      ? null
      : queue.sheet.status === "error"
        ? queue.sheet.message
        : queue.sheet.status === "unconfigured"
          ? "Add the RY-dentification form in RY-D settings to see what buyers sent."
          : "Connect the Google account that owns the RY-dentification form to see what buyers sent.";

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
              RY-D Verification <CountBadge size="lg">{activeCount}</CountBadge>
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
                disabled={!queue.installed || !unsent.length}
              >
                Send to fulfillment
              </Button>
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
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() => setDialog("settings")}
                >
                  Open settings
                </Button>
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
              className="flex flex-wrap gap-2 border-b border-black/10 pb-4 dark:border-white/10"
              role="group"
              aria-label="View"
            >
              {(Object.keys(VIEW_LABELS) as RydView[]).map((key) => {
                const Icon = VIEW_ICONS[key];
                return (
                  <FilterChip
                    key={key}
                    active={view === key}
                    onClick={() => {
                      setViewParam(key === "queue" ? "" : key);
                      setPage(1);
                    }}
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-black/70 dark:text-white/70">
                    Form answers no order has claimed: often a gift, a different
                    email, or an order that hasn&apos;t arrived in a file yet.
                  </p>
                  {unmatched.length > 0 && (
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        leftIcon={<FiMail aria-hidden />}
                        onClick={() => setDialog("unmatched-email")}
                        disabled={
                          searchPending ||
                          linking !== null ||
                          dismissing !== null ||
                          !contactable.length
                        }
                        title={
                          contactable.length
                            ? undefined
                            : "Everyone here was contacted in the last day."
                        }
                      >
                        Email everyone ({contactable.length})
                      </Button>
                      <RydUnmatchedLayoutToggle
                        layout={unmatchedLayout}
                        onChange={(next) =>
                          setLayoutParam(next === "cards" ? "" : next)
                        }
                      />
                    </div>
                  )}
                </div>
                {selectableSubmitters.length > 0 && (
                  <RydSelectionBar
                    total={selectableSubmitters.length}
                    scope="All contactable unmatched people in this view"
                    selectedCount={selectedSubmitters.length}
                    disabled={
                      searchPending ||
                      contacting !== null ||
                      linking !== null ||
                      dismissing !== null
                    }
                    onToggleAll={() =>
                      setSelectedSubmitterKeys(
                        selectedSubmitters.length === selectableSubmitters.length
                          ? new Set()
                          : new Set(selectableSubmitters.map((s) => s.key)),
                      )
                    }
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      leftIcon={<FiMail aria-hidden />}
                      disabled={
                        searchPending ||
                        linking !== null ||
                        dismissing !== null ||
                        contacting !== null ||
                        !selectedSubmitters.length
                      }
                      onClick={() => setDialog("unmatched-email-selected")}
                    >
                      Email selected
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      leftIcon={<FiCheckSquare aria-hidden />}
                      disabled={
                        searchPending ||
                        linking !== null ||
                        dismissing !== null ||
                        contacting !== null ||
                        !selectedSubmitters.length
                      }
                      loading={contacting === "*"}
                      loadingText="Marking..."
                      onClick={() =>
                        markContacted(selectedSubmitters.map((s) => s.email))
                      }
                    >
                      Mark contacted
                    </Button>
                  </RydSelectionBar>
                )}
                {unmatched.length === 0 && (
                  <EmptyState
                    className="py-12"
                    message={
                      queue.sheet.status === "ok"
                        ? "Every form submission is paired with an order."
                        : "No form submissions to show."
                    }
                  />
                )}
                <RydUnmatchedView
                  submitters={unmatched}
                  dismissed={queue.dismissed}
                  contacts={queue.contacts}
                  layout={unmatchedLayout}
                  orderOptions={orderOptions}
                  linking={linking}
                  busy={dismissing}
                  contacting={contacting}
                  onLink={linkSubmitter}
                  onMarkContacted={(email) => markContacted([email])}
                  selection={{
                    selected: selectedSubmitterKeys,
                    onToggle: toggleSubmitter,
                    disabled:
                      searchPending ||
                      contacting !== null ||
                      linking !== null ||
                      dismissing !== null,
                  }}
                  onRemove={setRemoving}
                  onRestore={(submission) => setDismissed(submission, true)}
                />
              </section>
            ) : (
              <section aria-label={VIEW_LABELS[view]} className="space-y-4">
                {view === "follow-up" && followUp.length > 0 && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-black/70 dark:text-white/70">
                      Orders asked for more, rejected, or with nothing on the
                      form. Email opens a draft asking the buyer for their
                      ry-dentification; rejected orders are never emailed.
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
                        setStatusParam(value === "pending" ? "" : value);
                        setProductionParam("");
                        setPage(1);
                      }}
                    />
                  )}
                  {(query ||
                    sort ||
                    (view === "queue" && status !== "pending")) && (
                    <ClearFiltersButton
                      className="self-start sm:self-center"
                      onClick={() => {
                        setQuery("");
                        setStatusParam("");
                        setProductionParam("");
                        setSortParam("");
                        setPage(1);
                      }}
                    />
                  )}
                </div>
                {producing && (
                  <div className="space-y-3">
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label="Filter by production"
                    >
                      <FilterChip
                        active={!production}
                        onClick={() => {
                          setProductionParam("");
                          setPage(1);
                        }}
                      >
                        All verified {counts.verified}
                      </FilterChip>
                      {RYD_PRODUCTION_STAGES.map((stage) => {
                        const Icon = RYD_PRODUCTION_ICONS[stage];
                        return (
                          <FilterChip
                            key={stage}
                            active={production === stage}
                            onClick={() => {
                              setProductionParam(stage);
                              setPage(1);
                            }}
                            className="inline-flex items-center gap-1.5"
                          >
                            <Icon aria-hidden className="h-3 w-3" />
                            {RYD_PRODUCTION_LABELS[stage]}{" "}
                            {productionCounts[stage]}
                          </FilterChip>
                        );
                      })}
                    </div>
                    {sorted.length > 0 && (
                      <RydSelectionBar
                        total={sorted.length}
                        selectedCount={selectedOrders.length}
                        disabled={searchPending || moving !== null}
                        onToggleAll={toggleAllOrders}
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="w-full sm:w-auto"
                          leftIcon={<FiPackage aria-hidden />}
                          disabled={
                            searchPending ||
                            moving !== null ||
                            !selectedStages.has("not-started")
                          }
                          loading={moving === "sent"}
                          onClick={() => moveSelected("sent")}
                        >
                          Sent for production
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="w-full sm:w-auto"
                          leftIcon={<FiCheckSquare aria-hidden />}
                          disabled={
                            searchPending ||
                            moving !== null ||
                            !selectedOrders.length ||
                            (selectedStages.size === 1 &&
                              selectedStages.has("done"))
                          }
                          loading={moving === "done"}
                          onClick={() => moveSelected("done")}
                        >
                          Done
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-full sm:w-auto"
                          leftIcon={<FiCornerUpLeft aria-hidden />}
                          disabled={
                            searchPending ||
                            moving !== null ||
                            !(
                              selectedStages.has("in-production") ||
                              selectedStages.has("done")
                            )
                          }
                          loading={moving === "back"}
                          onClick={() => moveSelected("back")}
                        >
                          Move back
                        </Button>
                      </RydSelectionBar>
                    )}
                  </div>
                )}
                {view === "follow-up" && sorted.length > 0 && (
                  <RydSelectionBar
                    total={sorted.length}
                    selectedCount={selectedOrders.length}
                    disabled={searchPending}
                    onToggleAll={toggleAllOrders}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      leftIcon={<FiMail aria-hidden />}
                      disabled={searchPending || !emailableSelected.length}
                      title={
                        selectedOrders.length && !emailableSelected.length
                          ? "Rejected orders are never emailed."
                          : undefined
                      }
                      onClick={() => setDialog("remind-selected")}
                    >
                      Email selected
                      {selectedOrders.length
                        ? ` (${emailableSelected.length})`
                        : ""}
                    </Button>
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
                                ? `No verified orders are ${RYD_PRODUCTION_LABELS[production].toLowerCase()}.`
                                : "No orders with that status."
                      }
                    />
                  ) : (
                    <RydOrderTable
                      orders={pageOrders}
                      ryanPositions={ryanPositions}
                      label={VIEW_LABELS[view]}
                      sort={sort}
                      onSort={(next) => {
                        setSortParam(rydSortValue(next));
                        setPage(1);
                      }}
                      followUp={view === "follow-up"}
                      onEmail={setEmailOrder}
                      onReview={(order) => setOpenOrderId(order.orderId)}
                      production={producing}
                      selection={
                        selectable
                          ? {
                              selected,
                              onToggle: toggleSelected,
                              disabled: searchPending || moving !== null,
                            }
                          : undefined
                      }
                      footer={pagination}
                    />
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
          onClose={() => setOpenOrderId("")}
          onChanged={refresh}
        />
      )}
      <ConfirmationDialog
        open={removing !== null}
        setOpen={(open) => {
          if (!open && dismissing === null) setRemoving(null);
        }}
        title="Remove this response?"
        description={
          removing
            ? `The response from ${removing.legalName || removing.email}${removing.submittedAt ? `, sent ${removing.submittedAt},` : ""} stops showing here and in match suggestions. It stays in the Google Form, and you can restore it from Removed responses.`
            : undefined
        }
        confirmLabel="Remove"
        pendingLabel="Removing"
        pending={dismissing !== null}
        destructive
        onConfirm={() => removing && setDismissed(removing)}
      />
      {dialog === "upload" && (
        <RydUploadDialog onClose={() => setDialog(null)} onChanged={refresh} />
      )}
      {dialog === "send" && (
        <RydSendDialog
          onClose={() => setDialog(null)}
          onChanged={refresh}
        />
      )}
      {emailOrder && <RydRemindDialog orders={[emailOrder]} title={`Email ${emailOrder.firstName || "buyer"}`} onClose={() => setEmailOrder(null)} onChanged={refresh} />}
      {(dialog === "remind" || dialog === "remind-selected") && (
        <RydRemindDialog
          {...(dialog === "remind-selected"
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
      {(contactOperation ||
        dialog === "unmatched-email" ||
        dialog === "unmatched-email-selected") && (
        <RydContactDialog
          emails={
            contactOperation ??
            (dialog === "unmatched-email-selected"
              ? selectedSubmitters
              : contactable
            ).map((submitter) => submitter.email)
          }
          draft={!contactOperation}
          title={
            contactOperation
              ? "Record contact"
              : dialog === "unmatched-email-selected"
                ? `Email ${selectedSubmitters.length} selected`
                : "Email unmatched submitters"
          }
          onClose={() => {
            setContactOperation(null);
            setDialog(null);
          }}
          onRecorded={contactsRecorded}
          onChanged={refresh}
        />
      )}
      {productionOperation && (
        <RydProductionDialog
          orders={productionOperation.orders}
          action={productionOperation.action}
          onApplied={productionApplied}
          onClose={() => {
            setProductionOperation(null);
            void refresh().catch(() =>
              toast.error(
                "The queue could not reload. Confirmed production changes stay saved.",
              ),
            );
          }}
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
