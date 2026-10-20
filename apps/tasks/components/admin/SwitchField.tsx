"use client";

/** The checkbox card the settings dialogs use for a plain on/off choice. */
export function SwitchField({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-black/30 accent-black dark:border-white/30 dark:accent-white"
      />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="mt-1 block text-black/60 dark:text-white/60">
          {description}
        </span>
      </span>
    </label>
  );
}
