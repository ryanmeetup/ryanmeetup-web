"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { FiChevronDown, FiFilter } from "react-icons/fi";
import { AnimatedCollapse } from "./AnimatedCollapse";
import { Card } from "./Card";
import { ClearFiltersButton } from "./ClearFiltersButton";

export type FilterPanelProps = {
  children: ReactNode;
  collapseOnMobile?: boolean;
  count: number;
  className?: string;
  controlsClassName?: string;
  defaultExpanded?: boolean;
  /** Controls that remain available when the filter fields are collapsed. */
  headerActions?: ReactNode;
  onClear?: () => void;
  preferenceStorageKey?: string;
  /** Short status at the end of the toggle row, such as a result count. */
  summary?: ReactNode;
};

const FilterPanel = ({
  children,
  collapseOnMobile = false,
  count,
  className,
  controlsClassName,
  defaultExpanded = false,
  headerActions,
  onClear,
  preferenceStorageKey,
  summary,
}: FilterPanelProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const summaryId = useId();

  useEffect(() => {
    const mobileQuery = collapseOnMobile
      ? window.matchMedia("(max-width: 639px)")
      : null;

    queueMicrotask(() => {
      if (mobileQuery?.matches) {
        setExpanded(false);
        return;
      }
      if (!preferenceStorageKey) return;

      const saved = localStorage.getItem(preferenceStorageKey);
      if (saved !== null) setExpanded(saved === "true");
    });

    function handleMobileChange(event: MediaQueryListEvent) {
      if (event.matches) setExpanded(false);
    }

    mobileQuery?.addEventListener("change", handleMobileChange);
    return () => mobileQuery?.removeEventListener("change", handleMobileChange);
  }, [collapseOnMobile, preferenceStorageKey]);

  const toggle = (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={panelId}
      aria-describedby={summary ? summaryId : undefined}
      onClick={() => setExpanded((current) => !current)}
      className={`flex cursor-pointer items-center gap-2 text-left text-xs font-semibold transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:hover:text-white dark:focus-visible:ring-white/30 ${headerActions ? "shrink-0 rounded-xl p-1 text-black/70 dark:text-white/70" : "w-full rounded-2xl p-4 text-black/70 dark:text-white/70"}`}
    >
      <FiFilter aria-hidden />
      Filters
      {count > 0 && (
        <b className="grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-[10px] text-white dark:bg-white dark:text-black">
          {count}
        </b>
      )}
      {summary && (
        // Hidden from the name so the toggle stays "Filters"; it is the description instead.
        <span id={summaryId} aria-hidden className={`${headerActions ? "" : "ml-auto"} whitespace-nowrap font-medium`}>
          {summary}
        </span>
      )}
      <FiChevronDown
        aria-hidden
        className={`${headerActions || summary ? "" : "ml-auto"} transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
      />
    </button>
  );

  return (
    <Card size="none" className={className}>
      {headerActions ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:px-4">
          {toggle}
          <div className="min-w-0 w-full sm:w-auto sm:flex-1">
            {headerActions}
          </div>
        </div>
      ) : (
        toggle
      )}
      <AnimatedCollapse id={panelId} open={expanded}>
        <div className="pb-4">
          <div
            className={`flex items-center gap-2 overflow-x-auto px-4 pb-1 ${controlsClassName ?? ""}`}
          >
            {children}
            {count > 0 && onClear && <ClearFiltersButton onClick={onClear} />}
          </div>
        </div>
      </AnimatedCollapse>
    </Card>
  );
};

export { FilterPanel };
