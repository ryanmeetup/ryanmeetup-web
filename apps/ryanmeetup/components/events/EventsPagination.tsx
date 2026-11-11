"use client";

import type { ReactNode } from "react";

type EventsPaginationProps = {
  currentPage: number;
  totalPages: number;
  pageButtons: number[];
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  onPage: (page: number) => void;
  firstIcon: ReactNode;
  previousIcon: ReactNode;
  nextIcon: ReactNode;
  lastIcon: ReactNode;
};

const getNavButtonClasses = (disabled: boolean) =>
  [
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-black/70 transition",
    "hover:border-black/40 hover:text-black",
    "dark:border-white/20 dark:text-white/70 dark:hover:border-white/40 dark:hover:text-white",
    disabled ? "opacity-60" : "",
  ]
    .filter(Boolean)
    .join(" ");

const EventsPagination = (props: EventsPaginationProps) => {
  const {
    currentPage,
    totalPages,
    pageButtons,
    onFirst,
    onPrevious,
    onNext,
    onLast,
    onPage,
    firstIcon,
    previousIcon,
    nextIcon,
    lastIcon,
  } = props;

  if (totalPages <= 1) return null;

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <div className="mt-4 flex items-center justify-center">
      <div className="mx-2 inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={onFirst}
          className={getNavButtonClasses(isFirstPage)}
          disabled={isFirstPage}
          aria-disabled={isFirstPage}
          aria-label="First page"
        >
          {firstIcon}
        </button>
        <button
          type="button"
          onClick={onPrevious}
          className={getNavButtonClasses(isFirstPage)}
          disabled={isFirstPage}
          aria-disabled={isFirstPage}
          aria-label="Previous page"
        >
          {previousIcon}
        </button>
        {pageButtons.map((pageNumber, index) => {
          const isActive = pageNumber === currentPage;
          const prevPage = pageButtons[index - 1];
          const showEllipsis = index > 0 && pageNumber - prevPage > 1;
          return (
            <div key={pageNumber} className="inline-flex items-center gap-1.5">
              {showEllipsis && (
                <span className="px-1 text-xs text-black/40 dark:text-white/40">
                  …
                </span>
              )}
              <button
                type="button"
                onClick={() => onPage(pageNumber)}
                className={`h-8 w-8 rounded-full border text-[10px] font-semibold uppercase tracking-caps transition sm:h-9 sm:w-9 sm:text-xs ${
                  isActive
                    ? "border-black/70 bg-black text-white dark:border-white/50 dark:bg-white dark:text-black"
                    : "border-black/20 text-black/70 hover:border-black/40 hover:text-black dark:border-white/20 dark:text-white/70 dark:hover:border-white/40 dark:hover:text-white"
                }`}
                aria-current={isActive}
              >
                {pageNumber}
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={onNext}
          className={getNavButtonClasses(isLastPage)}
          disabled={isLastPage}
          aria-disabled={isLastPage}
          aria-label="Next page"
        >
          {nextIcon}
        </button>
        <button
          type="button"
          onClick={onLast}
          className={getNavButtonClasses(isLastPage)}
          disabled={isLastPage}
          aria-disabled={isLastPage}
          aria-label="Last page"
        >
          {lastIcon}
        </button>
      </div>
    </div>
  );
};

export { EventsPagination };
