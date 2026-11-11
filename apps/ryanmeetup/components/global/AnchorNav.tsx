"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type AnchorNavItem = {
  href: string;
  icon: ReactNode;
  tooltip: string;
  children?: AnchorNavItem[];
};

type AnchorNavProps = {
  items: AnchorNavItem[];
  className?: string;
};

const AnchorNav = (props: AnchorNavProps) => {
  const { items, className } = props;
  const [expandedHref, setExpandedHref] = useState<string | null>(null);

  const anchorStyle =
    "group flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/90 text-black shadow-sm transition hover:-translate-y-1 hover:border-black/30 dark:border-white/15 dark:bg-black dark:text-white dark:hover:border-white/40";
  const childAnchorStyle =
    "group flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[10px] font-semibold text-black shadow-sm transition hover:-translate-y-1 hover:border-black/30 dark:border-white/15 dark:bg-black dark:text-white dark:hover:border-white/40";

  return (
    <div
      className={[
        "fixed bottom-4 right-1 z-50 flex flex-col gap-3 lg:bottom-8 lg:right-24",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => {
        const isExpanded = expandedHref === item.href;

        return (
          <div key={item.href} className="relative group">
            {item.children && item.children.length > 0 && isExpanded && (
              <div className="absolute bottom-full right-0 mb-3 flex flex-col gap-2">
                {item.children.map((child) => (
                  <div key={child.href} className="relative group/child">
                    <a href={child.href} className={childAnchorStyle}>
                      {child.icon}
                    </a>
                    <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-caps-wide text-white opacity-0 transition group-hover/child:opacity-100 dark:bg-white dark:text-black">
                      {child.tooltip}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <a
              href={item.href}
              className={anchorStyle}
              onClick={() => {
                if (!item.children?.length) {
                  return;
                }

                setExpandedHref((current) =>
                  current === item.href ? null : item.href,
                );
              }}
            >
              {item.icon}
            </a>
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-caps-wide text-white opacity-0 transition group-hover:opacity-100 dark:bg-white dark:text-black">
              {item.tooltip}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export { AnchorNav };
