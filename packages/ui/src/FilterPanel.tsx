"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  onClear?: () => void;
  preferenceStorageKey?: string;
};

const FilterPanel = ({
  children,
  collapseOnMobile = false,
  count,
  className,
  controlsClassName,
  defaultExpanded = false,
  onClear,
  preferenceStorageKey,
}: FilterPanelProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

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

  return (
    <Card size="none" className={className}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center gap-2 rounded-2xl p-4 text-left text-xs font-semibold uppercase tracking-widest text-black/50 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/30 dark:text-white/50 dark:hover:text-white dark:focus-visible:ring-white/30"
      >
        <FiFilter aria-hidden />
        Filters
        {count > 0 && (
          <b className="grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-[10px] text-white dark:bg-white dark:text-black">
            {count}
          </b>
        )}
        <FiChevronDown
          aria-hidden
          className={`ml-auto transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatedCollapse open={expanded}>
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
