"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "@ryanmeetup/ui";
import { errorMessage } from "@/lib/presentation";
import { RYD_STATUS_LABELS, type RydOrderStatus } from "@/lib/ryd/orders";
import { decideRydOrders, rydDecisionLocked } from "@/lib/ryd/ryd-decisions";
import { rydCardComplete } from "@/lib/ryd/card";
import {
  reconcileRydQueue,
  type RydQueueChange,
} from "@/lib/ryd/queue-reconciliation";
import type { RydQueue, RydQueueOrder } from "@/lib/ryd/queue-types";
import { canEmailRydOrder } from "@/lib/ryd/queue-view";
import { readyForRydFulfillment } from "@/lib/ryd/fulfillment-view";
import type {
  RydProductionAction,
  RydProductionResult,
} from "@/lib/ryd/bulk-operations";

/** The order dialogs a selection opens; one at a time. */
export type RydOrderDialogKind =
  | "send"
  | "remind"
  | "remind-selected"
  | "contacted-selected"
  | "cancel-selected";

/**
 * Bulk actions on the listed, selected orders: decide, cancel, email, and
 * move between fulfillment stages, with the state of the dialogs they open.
 */
export function useRydSelectionActions({
  queue,
  selectedOrders,
  setSelected,
  refresh,
  reconcile,
  onProductionMoved,
}: {
  queue: RydQueue;
  /** Only what's listed counts, so a filter change never acts on hidden rows. */
  selectedOrders: RydQueueOrder[];
  setSelected: Dispatch<SetStateAction<ReadonlySet<string>>>;
  refresh: () => Promise<void>;
  reconcile: (apply: (current: RydQueue) => RydQueue) => void;
  /** Follow the orders to the stage they were moved to. */
  onProductionMoved: (action: RydProductionAction) => void;
}) {
  const [dialog, setDialog] = useState<RydOrderDialogKind | null>(null);
  const [fulfillmentOrderIds, setFulfillmentOrderIds] = useState<
    string[] | null
  >(null);
  const [emailOrder, setEmailOrder] = useState<RydQueueOrder | null>(null);
  const [deciding, setDeciding] = useState<RydOrderStatus | null>(null);
  const [decisionPending, setDecisionPending] = useState(false);
  const [productionOperation, setProductionOperation] = useState<{
    action: RydProductionAction;
    orders: RydQueueOrder[];
  } | null>(null);
  const moving = productionOperation?.action ?? null;

  function applyChange(change: RydQueueChange) {
    reconcile((current) => reconcileRydQueue(current, change));
  }

  /**
   * The selected orders a decision would change. Final ones are left alone,
   * and an unfinished card is never verified: it would print a blank line.
   */
  function decidable(target: RydOrderStatus) {
    return selectedOrders.filter(
      (order) =>
        order.status !== target &&
        !rydDecisionLocked(order) &&
        (target !== "verified" || rydCardComplete(order.card)),
    );
  }
  function unfinishedCards(target: RydOrderStatus) {
    return target === "verified"
      ? selectedOrders.filter(
          (order) =>
            order.status !== target &&
            !rydDecisionLocked(order) &&
            !rydCardComplete(order.card),
        )
      : [];
  }

  /**
   * Share one provenance read per bounded group. Refused orders stay selected,
   * and changes land together so the confirmation count stays steady.
   */
  async function decideSelected(target: RydOrderStatus) {
    const orders = decidable(target);
    const unfinished = unfinishedCards(target).map((order) => order.orderId);
    setDecisionPending(true);
    const changes: RydQueueChange[] = [];
    const failed: string[] = [];
    let lastError: unknown;
    try {
      const result = await decideRydOrders(orders, queue.submissions, target);
      changes.push(
        ...result.reviews.map((review): RydQueueChange => ({
          type: "review",
          ...review,
        })),
      );
      failed.push(...result.failures.map((failure) => failure.orderId));
      const failure = result.failures.at(-1);
      if (failure) lastError = new Error(failure.message);
    } catch (error) {
      failed.push(...orders.map((order) => order.orderId));
      lastError = error;
    }
    changes.forEach(applyChange);
    try {
      await refresh();
    } catch {
      // The decisions saved; a reload shows them.
    }
    setSelected(new Set([...failed, ...unfinished]));
    setDeciding(null);
    setDecisionPending(false);
    const saved = orders.length - failed.length;
    if (saved)
      toast.success(
        `${saved} order${saved === 1 ? "" : "s"} marked ${RYD_STATUS_LABELS[target].toLowerCase()}.`,
      );
    if (failed.length)
      toast.error(
        errorMessage(
          lastError,
          `${failed.length} order${failed.length === 1 ? "" : "s"} couldn't be decided.`,
        ),
      );
  }

  function moveSelected(action: RydProductionAction) {
    if (moving !== null) return;
    setProductionOperation({ action, orders: selectedOrders });
  }

  function productionApplied(result: RydProductionResult) {
    if (productionOperation) onProductionMoved(productionOperation.action);
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

  function closeProduction() {
    setProductionOperation(null);
    void refresh().catch(() =>
      toast.error(
        "The queue could not reload. Confirmed production changes stay saved.",
      ),
    );
  }

  const selectedReady = readyForRydFulfillment(selectedOrders);
  function sendSelected() {
    setFulfillmentOrderIds(selectedReady.map((order) => order.orderId));
    setDialog("send");
  }

  return {
    dialog,
    setDialog,
    fulfillmentOrderIds,
    emailOrder,
    setEmailOrder,
    // Ticked by hand overrides the day's pause, but only orders still waiting
    // on the buyer are emailed.
    emailableSelected: selectedOrders.filter(canEmailRydOrder),
    selectedReady,
    sendSelected,
    deciding,
    setDeciding,
    decisionPending,
    decidable,
    unfinishedCards,
    decideSelected,
    productionOperation,
    moving,
    moveSelected,
    productionApplied,
    closeProduction,
  };
}

export type RydSelectionActions = ReturnType<typeof useRydSelectionActions>;
