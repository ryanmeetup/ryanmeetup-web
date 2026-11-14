"use client";

import type { ReactNode } from "react";
import { DisclosureCard } from "@ryanmeetup/ui";
import { FiCheckSquare } from "react-icons/fi";

/** One row's or card's checkbox, named for what it selects. */
export function RydSelectCheckbox({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 align-middle"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onToggle}
    />
  );
}

/**
 * Keep bulk tools tucked away until requested. The summary keeps the selected
 * count visible, and collapsing preserves the selection.
 */
export function RydSelectionBar({
  total,
  selectedCount,
  disabled,
  onToggleAll,
  children,
  scope = "All filtered orders, across every page",
}: {
  total: number;
  selectedCount: number;
  disabled?: boolean;
  onToggleAll: () => void;
  children: ReactNode;
  scope?: string;
}) {
  const allSelected = total > 0 && selectedCount === total;
  return (
    <DisclosureCard
      defaultOpen={false}
      className="rounded-2xl border border-black/10 dark:border-white/10"
      buttonClassName="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:focus-visible:ring-white/40"
      panelClassName="px-4 pb-4"
      iconClassName="h-3.5 w-3.5 motion-reduce:transition-none"
      summary={
        <span className="flex items-center gap-2">
          <FiCheckSquare aria-hidden className="shrink-0" />
          <span>Bulk actions</span>
          {selectedCount > 0 && (
            <span className="ml-auto text-xs font-normal text-black/70 dark:text-white/70">
              {selectedCount} selected
            </span>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allSelected}
              ref={(input) => {
                if (input)
                  input.indeterminate = selectedCount > 0 && !allSelected;
              }}
              disabled={disabled}
              onChange={onToggleAll}
            />
            {selectedCount
              ? `${selectedCount} of ${total} selected`
              : `Select all ${total}`}
          </label>
          <p className="mt-1 text-xs text-black/70 dark:text-white/70">
            {scope}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          {children}
        </div>
      </div>
    </DisclosureCard>
  );
}
