"use client";

import { MdKeyboardArrowDown } from "react-icons/md";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * The scrolling body shared by `Modal` and `Drawer`. A shade marks content
 * scrolled past at the top, and a "Scroll for more" pill marks content still
 * below, so nothing past the fold is missed.
 */
export const ScrollRegion = ({
  children,
  contentClassName,
}: {
  children: ReactNode;
  contentClassName?: string;
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
  });

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;

    if (!container) return;

    const scrollBuffer = 2;
    setScrollState({
      canScrollUp: container.scrollTop > scrollBuffer,
      canScrollDown:
        container.scrollTop + container.clientHeight <
        container.scrollHeight - scrollBuffer,
    });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const content = scrollContentRef.current;

    if (!container || !content) return;

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [updateScrollState]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollState}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        <div ref={scrollContentRef} className={`p-6 ${contentClassName ?? ""}`}>
          {children}
        </div>
      </div>
      {scrollState.canScrollUp && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-black/15 to-transparent dark:from-black/45"
        />
      )}
      {scrollState.canScrollDown && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-16 items-end justify-center bg-gradient-to-t from-white via-white/90 to-transparent pb-2 dark:from-[#181818] dark:via-[#181818]/90"
        >
          <span className="flex items-center gap-1 rounded-full border border-black/10 bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-black/65 shadow-sm dark:border-white/15 dark:bg-[#242424]/95 dark:text-white/70">
            Scroll for more
            <MdKeyboardArrowDown className="h-4 w-4" />
          </span>
        </div>
      )}
    </div>
  );
};
