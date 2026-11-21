"use client";

import { Fragment, type ReactNode } from "react";
import { Tooltip } from "@ryanmeetup/ui";

export type WorkspaceSwitchOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Set when the option cannot be chosen; the text says why, in a tooltip. */
  unavailable?: string;
};

/**
 * A segmented switch, such as the task board's view, assignee, and status
 * switches or the review queue's layout, in two forms. `toolbar` sits inside the desktop filter bar, which
 * supplies its own border and background. `grid` is the captioned, full-width
 * form the mobile actions menu stacks, where each switch has to carry its own
 * track and say what it controls.
 */
export function WorkspaceSwitch({
  ariaLabel,
  caption,
  onChange,
  options,
  value,
  variant = "toolbar",
}: {
  ariaLabel: string;
  caption: string;
  onChange: (value: string) => void;
  options: WorkspaceSwitchOption[];
  value: string;
  variant?: "toolbar" | "grid";
}) {
  const grid = variant === "grid";
  const track = (
    <div
      role="group"
      aria-label={ariaLabel}
      className={
        grid
          ? "grid w-full min-w-0 auto-cols-fr grid-flow-col rounded-lg border border-black/10 bg-white p-0.5 dark:border-white/10 dark:bg-white/5"
          : "flex min-w-0 p-1"
      }
    >
      {options.map((option) => {
        const button = (
          <button
            type="button"
            aria-pressed={
              option.unavailable ? undefined : option.value === value
            }
            disabled={Boolean(option.unavailable)}
            onClick={() => onChange(option.value)}
            className={`view-button [&_svg]:size-4 [&_svg]:shrink-0 ${
              grid
                ? "min-h-9 w-full min-w-0 px-2 tracking-caps-tight"
                : "px-3 tracking-caps-tight"
            } ${option.unavailable ? "opacity-40" : ""} ${
              option.value === value ? "view-button-active" : ""
            }`}
          >
            {option.icon} {option.label}
          </button>
        );
        return option.unavailable ? (
          <Tooltip key={option.value} content={option.unavailable}>
            {button}
          </Tooltip>
        ) : (
          <Fragment key={option.value}>{button}</Fragment>
        );
      })}
    </div>
  );
  if (!grid) return track;
  return (
    <div>
      <p
        aria-hidden="true"
        className="mb-1 text-[9px] font-semibold uppercase tracking-caps-tight text-black/45 dark:text-white/45"
      >
        {caption}
      </p>
      {track}
    </div>
  );
}
