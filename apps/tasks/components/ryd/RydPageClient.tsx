"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryParamState } from "@ryanmeetup/hooks";
import {
  Button,
  ErrorCallout,
  FilterChip,
  ManagementSurface,
  toast,
} from "@ryanmeetup/ui";
import type { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiInbox,
  FiPhoneOutgoing,
  FiRefreshCw,
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
import { errorMessage } from "@/lib/presentation";
import { RYD_STATUS_LABELS, type RydOrderStatus } from "@/lib/ryd/orders";
import {
  reconcileRydQueue,
  type RydQueueChange,
} from "@/lib/ryd/queue-reconciliation";
import type { RydQueue } from "@/lib/ryd/queue-types";
import {
  claimedElsewhere,
  followUpOrders,
  rydCounts,
  rydSortParam,
  rydStatusParam,
  rydView,
  unmatchedSubmitters,
  type RydStatusParam,
  type RydView,
} from "@/lib/ryd/queue-view";
import { rydFulfillmentParam } from "@/lib/ryd/fulfillment-view";
import type { WorkspaceData } from "@/lib/workspace/workspace-types";
import { RydSettingsDialog, RydUploadDialog } from "./RydDialogs";
import { RydOrderDialog } from "./RydOrderDialog";
import { RydOrdersSection } from "./RydOrdersSection";
import { RYD_STATUS_ICONS, RYD_STATUS_TONES } from "./RydStatusChip";
import { RydUnmatchedSection } from "./RydUnmatchedSection";
import { RydUploadDueNotice } from "./RydUploadDueNotice";
import { useRydQueueController } from "./useRydQueueController";

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
  auth: [false, "You need RY-D Settings access to connect Google."],
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
    param: "cancelled",
    label: RYD_STATUS_LABELS.rejected,
    mobileLabel: "Cancelled",
  },
];

export function RydPageClient({
  initialData,
  initialQueue,
  googleConfigured,
  canManageSettings,
}: {
  initialData: WorkspaceData;
  initialQueue: RydQueue;
  googleConfigured: boolean;
  /** RY-D Settings is locked separately from the queue. */
  canManageSettings: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { queue, refresh, refreshState, reconcile, showOlderDone } =
    useRydQueueController(initialQueue);
  const [dialog, setDialog] = useState<"upload" | "settings" | null>(null);
  const [viewParam, setViewParam] = useQueryParamState("view");
  const [statusParam, setStatusParam] = useQueryParamState("status");
  const [productionParam, setProductionParam] =
    useQueryParamState("production");
  const [sortParam, setSortParam] = useQueryParamState("sort");
  const [openOrderId, setOpenOrderId] = useQueryParamState("order");
  const [googleParam, setGoogleParam] = useQueryParamState("google");
  // Kept here so a selection survives switching views.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectedSubmitterKeys, setSelectedSubmitterKeys] = useState<
    ReadonlySet<string>
  >(new Set());
  const view = rydView(viewParam);
  const status = rydStatusParam(statusParam);
  const producing = view === "queue" && status === "verified";
  const { setPage } = usePagination();

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
  // Finished all round: fulfillment has been told and the RY-D is made.
  const activeCount = queue.orders.filter(
    (order) => !(order.doneAt && order.sentToFulfillment),
  ).length;
  const followUp = useMemo(() => followUpOrders(queue), [queue]);
  const unmatched = useMemo(() => unmatchedSubmitters(queue), [queue]);
  const openOrder = queue.orders.find((order) => order.orderId === openOrderId);

  function applyChange(change: RydQueueChange) {
    reconcile((current) => reconcileRydQueue(current, change));
  }

  const sheetNotice =
    queue.sheet.status === "ok"
      ? queue.sheet.warnings?.join(" ") || null
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
            <div className="flex w-full flex-col gap-2 2xl:flex-row 2xl:items-center">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full 2xl:w-auto"
                leftIcon={<FiUpload aria-hidden />}
                onClick={() => setDialog("upload")}
              >
                Upload orders
              </Button>
              {canManageSettings && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full 2xl:w-auto"
                  leftIcon={<FiSettings aria-hidden />}
                  onClick={() => setDialog("settings")}
                >
                  Settings
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-6">
            <div className="empty:hidden">
              {refreshState.pending && (
                <p
                  role="status"
                  className="text-sm text-black/70 dark:text-white/70"
                >
                  Refreshing orders and form responses...
                </p>
              )}
              {refreshState.error != null && (
                <ErrorCallout>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      The queue could not refresh. Confirmed changes stay saved.
                      The queue may be out of date.{" "}
                      {errorMessage(refreshState.error, "Try again.")}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full shrink-0 sm:w-auto"
                      onClick={() => void refresh().catch(() => {})}
                    >
                      Retry refresh
                    </Button>
                  </div>
                </ErrorCallout>
              )}
            </div>
            {sheetNotice && (
              <div
                role="status"
                className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
              >
                <p className="flex items-start gap-2">
                  <FiAlertTriangle aria-hidden className="mt-0.5 shrink-0" />
                  {sheetNotice}
                </p>
                {canManageSettings && (
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

            {queue.uploadDueSince && (
              <RydUploadDueNotice
                since={queue.uploadDueSince}
                timeZone={queue.timeZone}
                onUpload={() => setDialog("upload")}
              />
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
            <div
              className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-4 dark:border-white/10"
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
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full sm:ml-auto sm:w-auto"
                leftIcon={<FiRefreshCw aria-hidden />}
                loading={refreshState.pending}
                loadingText="Refreshing..."
                disabled={refreshState.pending}
                onClick={() => void refresh().catch(() => {})}
              >
                Refresh
              </Button>
            </div>

            {view === "unmatched" ? (
              <RydUnmatchedSection
                queue={queue}
                unmatched={unmatched}
                selected={selectedSubmitterKeys}
                setSelected={setSelectedSubmitterKeys}
                refreshing={refreshState.pending}
                refresh={refresh}
                reconcile={reconcile}
                onLinked={setOpenOrderId}
              />
            ) : (
              <RydOrdersSection
                view={view}
                label={VIEW_LABELS[view]}
                queue={queue}
                followUp={followUp}
                status={status}
                production={
                  producing ? rydFulfillmentParam(productionParam) : null
                }
                sort={rydSortParam(sortParam)}
                verifiedCount={counts.verified}
                selected={selected}
                setSelected={setSelected}
                refreshing={refreshState.pending}
                refresh={refresh}
                reconcile={reconcile}
                showOlderDone={showOlderDone}
                onStatusChange={setStatusParam}
                onProductionChange={setProductionParam}
                onSortChange={setSortParam}
                onReview={(order) => setOpenOrderId(order.orderId)}
              />
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
          fulfillmentEmail={queue.settings.fulfillmentEmail}
          onApplied={applyChange}
          onClose={() => setOpenOrderId("")}
          onChanged={refresh}
        />
      )}
      {dialog === "upload" && (
        <RydUploadDialog onClose={() => setDialog(null)} onChanged={refresh} />
      )}
      {dialog === "settings" && canManageSettings && (
        <RydSettingsDialog
          queue={queue}
          googleConfigured={googleConfigured}
          onApplied={applyChange}
          onClose={() => setDialog(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}
