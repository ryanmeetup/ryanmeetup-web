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
          ? "Select ready orders, then choose Generate email & CSV. Select all includes every order matching these filters, across every page."
          : stage === "sent-to-fulfillment"
            ? "Email recorded as sent. Select the orders fulfillment has acknowledged, then confirm production started."
            : stage === "in-production"
              ? "Fulfillment has confirmed these orders are being made. Mark them done when production is complete."
              : stage === "done"
                ? "These orders are finished."
                : "Ready to send → Sent to fulfillment → In production → Done. The email and production acknowledgment are recorded separately."}
      </p>
    </>
  );
}
