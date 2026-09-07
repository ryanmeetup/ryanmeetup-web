"use client";

import { useEffect, type RefObject } from "react";
import { boardStickyOffset } from "@/lib/tasks/board-sticky";

/** Spread onto the column and its heading so the hook can find them. */
export const boardColumnProps = { "data-board-column": "" };
export const boardColumnHeaderProps = { "data-board-column-header": "" };

/**
 * Keeps every column heading in view as the page scrolls past the top of the
 * board, so a card dragged near the bottom still lands in a named column. See
 * `boardStickyOffset` for why this is not just `position: sticky`.
 */
export function useBoardStickyHeaders(
  boardRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    let frame = 0;
    let sizes: ResizeObserver | null = null;

    const update = () => {
      frame = 0;
      const appHeader = document.querySelector(".tasks-app-header");
      const pinTop = appHeader?.getBoundingClientRect().bottom ?? 0;
      for (const column of board.querySelectorAll<HTMLElement>(
        "[data-board-column]",
      )) {
        const header = column.querySelector<HTMLElement>(
          "[data-board-column-header]",
        );
        if (!header) continue;
        // Columns come and go with the workspace's statuses; re-observing one
        // that is already watched is a no-op, so this doubles as registration.
        sizes?.observe(column);
        const offset = boardStickyOffset({
          columnTop: column.getBoundingClientRect().top,
          columnHeight: column.clientHeight,
          // offsetTop is layout-based, so it stays honest under the transform
          // the previous frame left behind.
          headerTop: header.offsetTop,
          headerHeight: header.offsetHeight,
          pinTop,
        });
        header.style.transform = offset ? `translateY(${offset}px)` : "";
        column.toggleAttribute("data-stuck", offset > 0);
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    sizes = new ResizeObserver(schedule);
    const children = new MutationObserver(schedule);
    children.observe(board, { childList: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      sizes.disconnect();
      children.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [boardRef]);
}
