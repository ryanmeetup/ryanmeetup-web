"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export type AnchorNavItem = {
  href: string;
  icon: ReactNode;
  /** Shown beside the button on hover or focus, and used as its accessible name. */
  tooltip: string;
  /** Opened above the item by clicking it, instead of jumping to its own anchor. */
  children?: AnchorNavItem[];
};

export type AnchorNavProps = {
  items: AnchorNavItem[];
  className?: string;
  /** Names the landmark for screen readers. */
  label?: string;
};

const anchorStyle =
  "flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/90 text-black shadow-sm transition hover:-translate-y-1 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/15 dark:bg-black dark:text-white dark:hover:border-white/40 dark:focus-visible:ring-white/40";
const childAnchorStyle =
  "flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[10px] font-semibold text-black shadow-sm transition hover:-translate-y-1 hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/15 dark:bg-black dark:text-white dark:hover:border-white/40 dark:focus-visible:ring-white/40";
const tooltipStyle =
  "pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-caps-wide text-white opacity-0 transition dark:bg-white dark:text-black";

/** A floating stack of icon links that jump to sections of a long page. */
const AnchorNav = ({ items, className, label = "Jump to section" }: AnchorNavProps) => {
  const [expandedHref, setExpandedHref] = useState<string | null>(null);

  return (
    <nav
      aria-label={label}
      className={[
        "fixed bottom-4 right-1 z-50 flex flex-col gap-3 lg:bottom-8 lg:right-24",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const isExpanded = expandedHref === item.href;

        return (
          <div key={item.href} className="group relative">
            {hasChildren && isExpanded && (
              <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2">
                {item.children?.map((child) => (
                  <div key={child.href} className="group/child relative">
                    <a
                      href={child.href}
                      aria-label={child.tooltip}
                      className={childAnchorStyle}
                    >
                      {child.icon}
                    </a>
                    <span
                      aria-hidden
                      className={`${tooltipStyle} group-focus-within/child:opacity-100 group-hover/child:opacity-100`}
                    >
                      {child.tooltip}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <a
              href={item.href}
              aria-label={item.tooltip}
              aria-expanded={hasChildren ? isExpanded : undefined}
              className={anchorStyle}
              onClick={() => {
                if (!hasChildren) return;
                setExpandedHref((current) =>
                  current === item.href ? null : item.href,
                );
              }}
            >
              {item.icon}
            </a>
            <span
              aria-hidden
              className={`${tooltipStyle} group-has-[>a:focus-visible]:opacity-100 group-has-[>a:hover]:opacity-100`}
            >
              {item.tooltip}
            </span>
          </div>
        );
      })}
    </nav>
  );
};

export { AnchorNav };
