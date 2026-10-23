import type { ReactNode } from "react";

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
 * Select all of what's listed, with the actions that take the selection
 * beside it. The checkbox goes indeterminate while only some are ticked.
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
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-white/10">
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
        <p className="mt-1 text-xs text-black/70 dark:text-white/70">{scope}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        {children}
      </div>
    </div>
  );
}
