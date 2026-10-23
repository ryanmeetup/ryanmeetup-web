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
    action === "sent"
      ? "Confirm production started"
      : action === "done"
        ? "Mark done"
        : "Move back one step";
  return (
    <Modal
      open
      title={label}
      description={
        action === "sent"
          ? "Use this after fulfillment confirms production has started. This records their acknowledgment for the selected orders already emailed to fulfillment."
          : action === "done"
            ? "Mark the selected orders finished after production is complete. Only orders currently in production are included."
            : "Done orders return to In production. Orders in production return to Sent to fulfillment when their email is recorded; otherwise they return to Ready to send. Email history stays recorded."
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
