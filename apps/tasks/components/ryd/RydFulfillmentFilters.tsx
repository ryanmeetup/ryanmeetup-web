import { Button, FilterChip } from "@ryanmeetup/ui";
import {
  RYD_FULFILLMENT_LABELS,
  RYD_FULFILLMENT_STAGES,
  type RydFulfillmentStage,
} from "@/lib/ryd/fulfillment-view";
import { RYD_DONE_WINDOW_DAYS, type RydQueue } from "@/lib/ryd/queue-types";
import { RYD_FULFILLMENT_ICONS } from "./RydStatusChip";

export function RydFulfillmentFilters({
  stage,
  counts,
  total,
  olderDone,
  loadingOlder,
  onChange,
  onShowOlder,
}: {
  stage: RydFulfillmentStage | null;
  counts: Record<RydFulfillmentStage, number>;
  total: number;
  olderDone: RydQueue["olderDone"];
  loadingOlder: boolean;
  onChange: (stage: RydFulfillmentStage | null) => void;
  onShowOlder: () => void;
}) {
  return (
    <>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by fulfillment stage"
      >
        <FilterChip active={!stage} onClick={() => onChange(null)}>
          All verified {total}
        </FilterChip>
        {RYD_FULFILLMENT_STAGES.map((value) => {
          const Icon = RYD_FULFILLMENT_ICONS[value];
          return (
            <FilterChip
              key={value}
              active={stage === value}
              onClick={() => onChange(value)}
              className="inline-flex items-center gap-1.5"
            >
              <Icon aria-hidden className="h-3 w-3" />
              {RYD_FULFILLMENT_LABELS[value]} {counts[value]}
            </FilterChip>
          );
        })}
      </div>
      <p className="text-sm text-black/70 dark:text-white/70">
        {stage === "ready-to-send"
          ? "Select ready orders to download their cards CSV or generate an email and CSV. After emailing fulfillment, mark them Sent to fulfillment. Every stage change is manual."
          : stage === "sent-to-fulfillment"
            ? "Fulfillment has these orders, dated by when you marked them sent. Select any to download their cards CSV again, mark them in production once fulfillment confirms they're being made, or mark them done once they're finished."
            : stage === "in-production"
              ? "Fulfillment is making these orders, dated by when you marked them in production. Mark them done once they're finished."
              : stage === "done"
                ? "These orders are finished."
                : "Ready to send → Sent to fulfillment → In production → Done. Move orders between stages manually; generating an email changes nothing, and In production can be skipped."}
      </p>
      {(!stage || stage === "done") && olderDone && olderDone.count > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-black/70 dark:text-white/70">
            Done counts cover the last {RYD_DONE_WINDOW_DAYS} days.{" "}
            {olderDone.count === 1
              ? "1 older order is"
              : `${olderDone.count.toLocaleString()} older orders are`}{" "}
            finished and tucked away.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full shrink-0 sm:w-auto"
            loading={loadingOlder}
            onClick={onShowOlder}
          >
            Show older
          </Button>
        </div>
      )}
    </>
  );
}
