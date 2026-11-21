"use client";

import { Fragment } from "react";
import { Button, DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItems, DropdownMenuSeparator, Text } from "@ryanmeetup/ui";
import { BULK_REVIEW_ACTIONS, bulkReviewActionLabels, bulkReviewTargets } from "@/lib/store-reviews/bulk-moderation";
import type { BulkReviewAction } from "@/lib/store-reviews/bulk-moderation";
import type { ModerationReview } from "@/lib/store-reviews/moderation";
import { ReviewSelectionCheckbox } from "./ReviewSelectionCheckbox";

export function ReviewBulkActions({ reviews, selectedIds, disabled, searching = false, onToggleAll, onClear, onAction }: {
  reviews: ModerationReview[]; selectedIds: ReadonlySet<string>; disabled: boolean;
  /** A search narrows the rows on screen, so counts name matches rather than everything loaded. */
  searching?: boolean;
  onToggleAll: () => void; onClear: () => void; onAction: (action: BulkReviewAction) => void;
}) {
  const scope = searching ? "matching" : "loaded";
  const selected = reviews.filter((review) => selectedIds.has(review.id));
  const allSelected = selected.length === reviews.length;
  const actions = BULK_REVIEW_ACTIONS.map((action) => ({ action, count: bulkReviewTargets(selected, action).length }))
    .filter(({ count }) => count > 0);
  return <div className="space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/10">
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <ReviewSelectionCheckbox label={`Select all ${reviews.length} ${scope} reviews`} checked={allSelected}
          indeterminate={selected.length > 0 && !allSelected} disabled={disabled} onChange={onToggleAll} />
        {selected.length} of {reviews.length} {scope} reviews selected
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {selected.length > 0 && <Button size="sm" variant="ghost" disabled={disabled} onClick={onClear}>Clear selection</Button>}
        <DropdownMenu>
          <DropdownMenuButton disabled={disabled || selected.length === 0} className="w-full sm:w-auto">Bulk actions</DropdownMenuButton>
          <DropdownMenuItems align="end">
            {actions.map(({ action, count }) => <Fragment key={action}>
              {action === "delete" && actions.length > 1 && <DropdownMenuSeparator />}
              <DropdownMenuItem destructive={action === "delete"} onClick={() => onAction(action)}>
                {bulkReviewActionLabels[action]} ({count})
              </DropdownMenuItem>
            </Fragment>)}
          </DropdownMenuItems>
        </DropdownMenu>
      </div>
    </div>
    <Text className="text-xs">Select all includes {scope} reviews only. Action counts include only eligible selected reviews.</Text>
  </div>;
}
