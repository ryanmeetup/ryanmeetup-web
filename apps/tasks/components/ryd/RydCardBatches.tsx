"use client";

import { useState } from "react";
import { Button, ConfirmationDialog, toast } from "@ryanmeetup/ui";
import { FiDownload, FiPrinter } from "react-icons/fi";
import { mutate } from "@/lib/mutation-client";
import { errorMessage } from "@/lib/presentation";
import { rydCardComplete } from "@/lib/ryd/card";
import type { RydCardBatch } from "@/lib/ryd/card-export";
import { formatRydDay } from "@/lib/ryd/form-responses";
import { rydFulfillmentStage } from "@/lib/ryd/fulfillment-view";
import type { RydQueueOrder } from "@/lib/ryd/queue-types";

/** Verified, approved, and not yet pulled: what the next card file holds. */
export function rydPrintableOrders(orders: RydQueueOrder[]) {
  return orders.filter(
    (order) =>
      order.status === "verified" &&
      order.cardSaved &&
      rydCardComplete(order.card) &&
      rydFulfillmentStage(order) === "ready-to-send",
  );
}

const batchHref = (id: string) => `/api/ryd/cards/${encodeURIComponent(id)}`;

/** Start the browser's download of a batch without leaving the page. */
function download(id: string) {
  const link = document.createElement("a");
  link.href = batchHref(id);
  link.download = "";
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * The card file fulfillment prints from. Pulling it marks those orders sent
 * to fulfillment with today's date, so nothing prints twice; downloading a
 * past batch again changes nothing.
 */
export function RydCardBatches({
  orders,
  batches,
  timeZone,
  disabled,
  onPulled,
}: {
  orders: RydQueueOrder[];
  batches: RydCardBatch[];
  timeZone: string;
  disabled: boolean;
  onPulled: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  // One operation per confirmation, so a retried request returns its batch.
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const printable = rydPrintableOrders(orders).length;

  async function pull() {
    setPending(true);
    try {
      const result = await mutate<{
        batchId: string | null;
        orderCount: number;
      }>("/api/ryd/cards", {
        method: "POST",
        body: JSON.stringify({ operationId }),
      });
      setConfirming(false);
      setOperationId(crypto.randomUUID());
      if (result.batchId) {
        download(result.batchId);
        toast.success(
          `${result.orderCount} card${result.orderCount === 1 ? "" : "s"} pulled and marked sent to fulfillment.`,
        );
      } else toast.success("No approved cards were waiting.");
      await onPulled().catch(() => {
        // The batch is saved; a reload shows it.
      });
    } catch (error) {
      toast.error(errorMessage(error, "The cards couldn't be pulled."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="ryd-card-batches-heading"
      className="space-y-3 rounded-2xl border border-black/10 p-4 dark:border-white/10"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3
            id="ryd-card-batches-heading"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/70 dark:text-white/70"
          >
            <FiPrinter aria-hidden />
            Card files
          </h3>
          <p className="text-sm text-black/70 dark:text-white/70">
            {printable
              ? `${printable} approved card${printable === 1 ? " is" : "s are"} ready to print.`
              : "No approved cards are waiting. Verified orders appear here once their card is approved."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full shrink-0 sm:w-auto"
          leftIcon={<FiDownload aria-hidden />}
          disabled={disabled || !printable}
          onClick={() => setConfirming(true)}
        >
          Download new cards ({printable})
        </Button>
      </div>
      {batches.length > 0 && (
        <ul
          aria-label="Past card files"
          className="divide-y divide-black/10 border-y border-black/10 dark:divide-white/10 dark:border-white/10"
        >
          {batches.map((batch) => (
            <li
              key={batch.id}
              className="flex flex-col gap-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="min-w-0">
                <span className="font-semibold">
                  {formatRydDay(batch.createdAt, timeZone)}
                </span>
                <span className="text-black/70 dark:text-white/70">
                  {" · "}
                  {batch.orderCount} card{batch.orderCount === 1 ? "" : "s"}
                  {batch.createdBy ? ` · ${batch.createdBy}` : ""}
                </span>
              </span>
              <Button.Link
                href={batchHref(batch.id)}
                download
                prefetch={false}
                size="xs"
                variant="ghost"
                className="w-full sm:w-auto"
                leftIcon={<FiDownload aria-hidden />}
                aria-label={`Download the ${formatRydDay(batch.createdAt, timeZone)} card file again`}
              >
                Download again
              </Button.Link>
            </li>
          ))}
        </ul>
      )}
      <ConfirmationDialog
        open={confirming}
        setOpen={(open) => {
          if (!open && !pending) setConfirming(false);
        }}
        title={`Download ${printable} card${printable === 1 ? "" : "s"}?`}
        description="Every approved card that hasn't printed goes in the file, and those orders are marked sent to fulfillment with today's date so they never print twice. Unfinished or unapproved cards wait for the next file."
        confirmLabel="Download"
        pendingLabel="Pulling cards..."
        pending={pending}
        onConfirm={() => void pull()}
      />
    </section>
  );
}
