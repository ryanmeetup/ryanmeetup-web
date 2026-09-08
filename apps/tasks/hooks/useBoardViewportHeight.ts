"use client";

import { useLayoutEffect, type RefObject } from "react";

/** Size the board so the page ends with equal outside space above and below. */
export function useBoardViewportHeight(
  boardRef: RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const board = boardRef.current;
    const page = board?.closest<HTMLElement>("[data-board-page]");
    const shell = board?.closest("[data-workspace-shell]");
    if (!board || !page || !shell) return;

    const header = shell.querySelector<HTMLElement>(".tasks-app-header");
    const banners = shell.querySelector<HTMLElement>(
      "[data-workspace-banners]",
    );
    const measure = () => {
      const pageStyle = getComputedStyle(page);
      const gap = Number.parseFloat(pageStyle.paddingTop) || 0;
      const bottomGap = Number.parseFloat(pageStyle.paddingBottom) || 0;
      const inset =
        (header?.offsetHeight ?? 0) + (banners?.offsetHeight ?? 0) + gap;
      board.style.setProperty("--board-top-inset", `${inset}px`);
      board.style.setProperty("--board-bottom-inset", `${bottomGap}px`);
    };
    const sizes = new ResizeObserver(measure);
    if (header) sizes.observe(header);
    if (banners) sizes.observe(banners);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      sizes.disconnect();
      window.removeEventListener("resize", measure);
      board.style.removeProperty("--board-top-inset");
      board.style.removeProperty("--board-bottom-inset");
    };
  }, [boardRef]);
}
