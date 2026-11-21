"use client";

/** No shared checkbox primitive exists; use the native multi-selection control. */
export function ReviewSelectionCheckbox({ label, checked, indeterminate = false, disabled, onChange }: {
  label: string; checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange: () => void;
}) {
  return <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={onChange}
    ref={(input) => { if (input) input.indeterminate = indeterminate; }}
    className="size-4 shrink-0 rounded border-black/30 accent-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/30 dark:accent-white dark:focus-visible:outline-white" />;
}
