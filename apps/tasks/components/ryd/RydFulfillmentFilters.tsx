import { FilterChip } from "@ryanmeetup/ui";
import {
  RYD_FULFILLMENT_LABELS,
  RYD_FULFILLMENT_STAGES,
  type RydFulfillmentStage,
} from "@/lib/ryd/fulfillment-view";
import { RYD_FULFILLMENT_ICONS } from "./RydStatusChip";

export function RydFulfillmentFilters({
  stage,
  counts,
  total,
  onChange,
}: {
  stage: RydFulfillmentStage | null;
  counts: Record<RydFulfillmentStage, number>;
  total: number;
  onChange: (stage: RydFulfillmentStage | null) => void;
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
          ? "Select ready orders to generate an email and CSV. After emailing fulfillment, mark them Sent to fulfillment. Every stage change is manual."
          : stage === "sent-to-fulfillment"
            ? "Fulfillment has these orders, dated by when you marked them sent. Mark them done once they're finished."
            : stage === "done"
              ? "These orders are finished."
              : "Ready to send → Sent to fulfillment → Done. Move orders between stages manually; generating an email changes nothing."}
      </p>
    </>
  );
}
