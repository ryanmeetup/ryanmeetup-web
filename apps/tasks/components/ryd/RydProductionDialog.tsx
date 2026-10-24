"use client";

import { ErrorCallout, Modal, ModalActions } from "@ryanmeetup/ui";
import type {
  RydProductionAction,
  RydProductionResult,
} from "@/lib/ryd/bulk-operations";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";
import { useRydProductionOperation } from "./useRydProductionOperation";

export function RydProductionDialog({
  orders,
  action,
  onApplied,
  onClose,
}: {
  orders: RydQueueOrder[];
  action: RydProductionAction;
  onApplied: (result: RydProductionResult) => void;
  onClose: () => void;
}) {
  const operation = useRydProductionOperation(orders, action, onApplied);
  const done = operation.completed === operation.total;
  const label =
    action === "fulfillment"
      ? "Mark sent to fulfillment"
      : action === "done"
        ? "Mark done"
        : "Move back one step";
  return (
    <Modal
      open
      title={label}
      description={
        action === "fulfillment"
          ? "Use this after you have emailed these orders to fulfillment. This moves the selected ready orders to Sent to fulfillment and records today as their send date."
          : action === "done"
            ? "Mark the selected orders finished. Only orders already sent to fulfillment are included."
            : "Move the selected orders back one stage: Done → Sent to fulfillment → Ready to send."
      }
      setIsOpen={(open) => !open && !operation.pending && onClose()}
      closable={!operation.pending}
      actions={
        <ModalActions
          confirmLabel={
            done ? "Close" : operation.error ? "Retry remaining orders" : label
          }
          onConfirm={done ? onClose : operation.run}
          onCancel={done ? undefined : onClose}
          pending={operation.pending}
          pendingLabel="Saving orders..."
        />
      }
    >
      <div className="space-y-4">
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-black/70 dark:text-white/70"
        >
          {operation.completed} of {operation.total} orders confirmed saved ·{" "}
          {operation.groupCount} groups
        </p>
        <ErrorCallout>{operation.error}</ErrorCallout>
        {operation.error && (
          <p className="text-sm text-black/70 dark:text-white/70">
            Completed groups stay saved. The unconfirmed group may have saved
            too; retry uses the same operation and cannot move it twice. A
            changed order requires reloading and reviewing the remaining
            selection.
          </p>
        )}
      </div>
    </Modal>
  );
}
