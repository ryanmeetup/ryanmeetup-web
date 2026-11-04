"use client";

import { Button, Tooltip, toast } from "@ryanmeetup/ui";
import {
  FiCheckSquare,
  FiCornerUpLeft,
  FiDownload,
  FiMail,
  FiSend,
} from "react-icons/fi";
import { rydSelectedCardsFile } from "@/lib/ryd/card-export";
import {
  rydFulfillmentCounts,
  rydFulfillmentStage,
  type RydFulfillmentStage,
} from "@/lib/ryd/fulfillment-view";
import { RYD_FULFILLMENT_LIMIT } from "@/lib/ryd/fulfillment";
import type { RydQueue, RydQueueOrder } from "@/lib/ryd/queue-types";
import { RydCardBatches } from "./RydCardBatches";
import { RydFulfillmentFilters } from "./RydFulfillmentFilters";
import { RydSelectionBar } from "./RydSelection";
import type { RydSelectionActions } from "./useRydSelectionActions";

/** The Verified view's handoff tools: card files, stage filters, and moves. */
export function RydProductionPanel({
  queue,
  stage,
  verifiedCount,
  listed,
  selectedOrders,
  actions,
  disabled,
  loadingOlder,
  onStageChange,
  onShowOlder,
  onToggleAll,
  onPulled,
}: {
  queue: RydQueue;
  stage: RydFulfillmentStage | null;
  verifiedCount: number;
  /** Every order matching the filters, across pages. */
  listed: RydQueueOrder[];
  selectedOrders: RydQueueOrder[];
  actions: RydSelectionActions;
  /** A search is still settling. */
  disabled: boolean;
  loadingOlder: boolean;
  onStageChange: (stage: RydFulfillmentStage | null) => void;
  onShowOlder: () => void;
  onToggleAll: () => void;
  onPulled: () => Promise<void>;
}) {
  const { moving, moveSelected, selectedReady } = actions;
  const busy = disabled || moving !== null;
  const canGenerate =
    selectedOrders.length > 0 &&
    selectedReady.length === selectedOrders.length &&
    selectedReady.length <= RYD_FULFILLMENT_LIMIT;
  const selectedStages = new Set(selectedOrders.map(rydFulfillmentStage));
  const shows = (...stages: RydFulfillmentStage[]) =>
    !stage || stages.includes(stage);
  const cardsFile = rydSelectedCardsFile(selectedOrders, queue.timeZone);

  function downloadCards() {
    const url = URL.createObjectURL(
      new Blob([cardsFile.csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = cardsFile.filename;
    document.body.append(link);
    link.click();
    link.remove();
    // Safari reads the blob after click() returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const count = cardsFile.printable.length;
    toast.success(
      `${count} card${count === 1 ? "" : "s"} downloaded. No stages changed.`,
    );
    if (cardsFile.skipped)
      toast.error(
        `${cardsFile.skipped} selected card${cardsFile.skipped === 1 ? " was" : "s were"} left out: missing a name, location, or year.`,
      );
  }

  return (
    <div className="space-y-3">
      <RydCardBatches
        orders={queue.orders}
        batches={queue.cardBatches}
        timeZone={queue.timeZone}
        disabled={busy}
        onPulled={onPulled}
      />
      <RydFulfillmentFilters
        stage={stage}
        counts={rydFulfillmentCounts(queue.orders)}
        total={verifiedCount}
        olderDone={queue.olderDone}
        loadingOlder={loadingOlder}
        onChange={onStageChange}
        onShowOlder={onShowOlder}
      />
      {listed.length > 0 && (
        <RydSelectionBar
          total={listed.length}
          selectedCount={selectedOrders.length}
          disabled={busy}
          onToggleAll={onToggleAll}
        >
          {shows("ready-to-send", "sent-to-fulfillment") && (
            // A disabled button gets no hover, so the wrapper carries the tooltip.
            <Tooltip
              content={
                selectedOrders.length
                  ? "None of the selected cards has a name, location, and year."
                  : "Select the orders to put in the file."
              }
              disabled={cardsFile.printable.length > 0}
              triggerClassName="w-full sm:w-auto"
            >
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full disabled:pointer-events-none sm:w-auto"
                leftIcon={<FiDownload aria-hidden />}
                disabled={busy || !cardsFile.printable.length}
                onClick={downloadCards}
              >
                Download cards CSV ({cardsFile.printable.length})
              </Button>
            </Tooltip>
          )}
          {shows("ready-to-send") && (
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              leftIcon={<FiSend aria-hidden />}
              disabled={busy || !canGenerate}
              title={
                selectedReady.length > RYD_FULFILLMENT_LIMIT
                  ? `Select up to ${RYD_FULFILLMENT_LIMIT} orders per batch.`
                  : selectedOrders.length && !canGenerate
                    ? "Select only orders marked Ready to send."
                    : undefined
              }
              onClick={actions.sendSelected}
            >
              Generate email &amp; CSV ({selectedReady.length})
            </Button>
          )}
          {shows("ready-to-send") && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              leftIcon={<FiMail aria-hidden />}
              disabled={busy || !selectedStages.has("ready-to-send")}
              onClick={() => moveSelected("fulfillment")}
            >
              Mark sent to fulfillment
            </Button>
          )}
          {shows("sent-to-fulfillment") && (
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              leftIcon={<FiCheckSquare aria-hidden />}
              disabled={busy || !selectedStages.has("sent-to-fulfillment")}
              loading={moving === "done"}
              onClick={() => moveSelected("done")}
            >
              Done
            </Button>
          )}
          {shows("sent-to-fulfillment", "done") && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full sm:w-auto"
              leftIcon={<FiCornerUpLeft aria-hidden />}
              disabled={
                busy ||
                !(
                  selectedStages.has("sent-to-fulfillment") ||
                  selectedStages.has("done")
                )
              }
              loading={moving === "back"}
              onClick={() => moveSelected("back")}
            >
              Move back
            </Button>
          )}
        </RydSelectionBar>
      )}
    </div>
  );
}
