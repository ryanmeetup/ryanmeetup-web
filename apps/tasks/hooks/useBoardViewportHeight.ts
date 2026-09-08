"use client";

import { useLayoutEffect, type RefObject } from "react";

/** Reserve only the toolbar, visible notices, and the outside page inset. */
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
      const gap = Number.parseFloat(getComputedStyle(page).paddingTop) || 0;
      const inset =
        (header?.offsetHeight ?? 0) + (banners?.offsetHeight ?? 0) + gap;
      board.style.setProperty("--board-top-inset", `${inset}px`);
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
    };
  }, [boardRef]);
}
