"use client";

import { Button } from "@ryanmeetup/ui";
import { FiCheckSquare, FiCornerUpLeft, FiMail, FiSend } from "react-icons/fi";
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
