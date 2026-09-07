"use client";

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  Avatar,
  getFilterControlClasses,
  type AvatarProps,
  useProximityOptions,
} from "@ryanmeetup/ui";
import { FiCheck, FiChevronDown, FiMinus, FiPlus } from "react-icons/fi";
import { Fragment, type ReactNode } from "react";

export type ActivityFilterOption = {
  avatar?: AvatarProps;
  /** Swatch for options that carry one of their own, such as a status. */
  color?: string | null;
  group?: { color?: string | null; icon?: ReactNode; label: string };
  label: string;
  value: string;
};

export function ActivityFilterMenu({
  emptyLabel,
  excludedValues,
  includedValues,
  label,
  onExcludedChange,
  onIncludedChange,
  options,
  proximityGroup,
  proximityValue,
  stackLabelOnMobile = false,
}: {
  /** Summary shown while nothing is picked. Defaults to "Any <label>". */
  emptyLabel?: string;
  excludedValues: string[];
  includedValues: string[];
  label: string;
  onExcludedChange: (values: string[]) => void;
  onIncludedChange: (values: string[]) => void;
  options: ActivityFilterOption[];
  proximityGroup?: string;
  proximityValue?: string;
  stackLabelOnMobile?: boolean;
}) {
  const { orderedOptions, setAnchorElement } = useProximityOptions(
    options,
    proximityValue,
    proximityGroup,
  );
  const included = new Set(includedValues);
  const excluded = new Set(excludedValues);
  const active = included.size > 0 || excluded.size > 0;
  const summary =
    included.size === 0 && excluded.size === 0
      ? (emptyLabel ?? `Any ${label.toLowerCase()}`)
      : [
          included.size ? `${included.size} included` : "",
          excluded.size ? `${excluded.size} excluded` : "",
        ]
          .filter(Boolean)
          .join(" · ");

  function include(value: string) {
    onIncludedChange(
      included.has(value)
        ? includedValues.filter((item) => item !== value)
        : [...includedValues, value],
    );
    if (excluded.has(value))
      onExcludedChange(excludedValues.filter((item) => item !== value));
  }

  function exclude(value: string) {
    onExcludedChange(
      excluded.has(value)
        ? excludedValues.filter((item) => item !== value)
        : [...excludedValues, value],
    );
    if (included.has(value))
      onIncludedChange(includedValues.filter((item) => item !== value));
  }

  return (
    <Popover className="relative min-w-0 shrink-0">
      <PopoverButton
        className={`${getFilterControlClasses(active)} ${stackLabelOnMobile ? "!grid w-full grid-cols-[7rem_minmax(0,1fr)_auto] justify-stretch gap-3 px-3 py-2.5 text-left lg:!inline-flex lg:w-auto lg:justify-center lg:gap-2 lg:px-3 lg:py-1.5" : ""}`}
      >
        <span
          className={`${stackLabelOnMobile ? "text-[10px] font-semibold uppercase tracking-wider text-black/55 dark:text-white/55 lg:text-xs lg:normal-case lg:tracking-normal" : "text-black/50 dark:text-white/50"}`}
        >
          {label}
        </span>
        <span className="min-w-0 truncate">{summary}</span>
        <FiChevronDown
          aria-hidden
          className={`${stackLabelOnMobile ? "ml-auto" : ""} text-black/40 dark:text-white/40`}
        />
      </PopoverButton>
      <PopoverPanel
        ref={setAnchorElement}
        anchor={{ to: "bottom start", padding: 16 }}
        className={`z-50 mt-2 max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 bg-white/95 p-2 text-black shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#181818]/95 dark:text-white ${stackLabelOnMobile ? "w-[var(--button-width)] lg:w-80" : "w-80"}`}
      >
        <div className="flex items-center px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-black/45 dark:text-white/45">
          <span className="flex-1">{label}</span>
          <span className="w-16 text-center">Include</span>
          <span className="w-16 text-center">Exclude</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {orderedOptions.map((option, index) => {
            const showGroup =
              option.group &&
              option.group.label !== orderedOptions[index - 1]?.group?.label;
            const accessibleLabel = option.group
              ? `${option.group.label}: ${option.label}`
              : option.label;

            return (
              <Fragment key={option.value}>
                {showGroup && (
                  <div className="mb-1 mt-2 flex items-center gap-2 border-b border-black/10 px-2 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-black/55 first:mt-0 dark:border-white/10 dark:text-white/55">
                    {option.group?.icon}
                    {option.group?.color && (
                      <i
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: option.group.color }}
                      />
                    )}
                    <span className="truncate">{option.group?.label}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">
                  {option.avatar && <Avatar {...option.avatar} size="sm" />}
                  {option.color && (
                    <i
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {option.label}
                  </span>
                  <button
                    type="button"
                    aria-label={`${included.has(option.value) ? "Stop including" : "Include"} ${accessibleLabel}`}
                    aria-pressed={included.has(option.value)}
                    onClick={() => include(option.value)}
                    className="grid h-8 w-16 place-items-center rounded-md border border-transparent text-black/45 transition hover:bg-black/10 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 aria-pressed:border-emerald-500/30 aria-pressed:bg-emerald-500/15 aria-pressed:text-emerald-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/30 dark:aria-pressed:text-emerald-300"
                  >
                    {included.has(option.value) ? <FiCheck /> : <FiPlus />}
                  </button>
                  <button
                    type="button"
                    aria-label={`${excluded.has(option.value) ? "Stop excluding" : "Exclude"} ${accessibleLabel}`}
                    aria-pressed={excluded.has(option.value)}
                    onClick={() => exclude(option.value)}
                    className="grid h-8 w-16 place-items-center rounded-md border border-transparent text-black/45 transition hover:bg-black/10 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 aria-pressed:border-red-500/30 aria-pressed:bg-red-500/15 aria-pressed:text-red-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/30 dark:aria-pressed:text-red-300"
                  >
                    <FiMinus />
                  </button>
                </div>
              </Fragment>
            );
          })}
        </div>
      </PopoverPanel>
    </Popover>
  );
}
