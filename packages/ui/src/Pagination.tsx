"use client";

import clsx from "clsx";
import {
  FiChevronsLeft,
  FiChevronsRight,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { DropdownSelect } from "./DropdownSelect";
import { IconButton } from "./IconButton";

export type PaginationProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  /** More cursor pages exist; totalCount is the number loaded so far. */
  hasMore?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  itemLabel?: string;
  /** Names the page size control; "Rows" suits tables, card lists may say "Per page". */
  pageSizeLabel?: string;
  /** Pads the bar for a card footer. Turn off when it sits in open page flow. */
  inset?: boolean;
  disabled?: boolean;
  className?: string;
};

export function Pagination({
  page,
  pageSize,
  totalCount,
  hasMore = false,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "items",
  pageSizeLabel = "Rows",
  inset = true,
  disabled = false,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  const atStart = currentPage === 1;
  const atEnd = !hasMore && (totalCount === 0 || currentPage === totalPages);

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className={clsx(
        "flex flex-wrap items-center justify-between gap-3 border-t border-black/10 py-3 text-sm dark:border-white/10",
        inset && "px-4",
        className,
      )}
    >
      <p className="text-black/60 dark:text-white/60">
        Showing {start}–{end}{!hasMore && ` of ${totalCount}`} {itemLabel}
      </p>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <DropdownSelect
          label={pageSizeLabel}
          disabled={disabled}
          value={String(pageSize)}
          onChange={(value) => onPageSizeChange(Number.parseInt(value, 10))}
          options={pageSizeOptions.map((size) => ({
            label: String(size),
            value: String(size),
          }))}
        />
        <span className="whitespace-nowrap px-1 text-xs text-black/60 dark:text-white/60">
          Page {currentPage}{!hasMore && ` of ${totalPages}`}
        </span>
        <IconButton
          className="max-sm:hidden disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
          label="First page"
          disabled={disabled || atStart}
          onClick={() => onPageChange(1)}
        >
          <FiChevronsLeft />
        </IconButton>
        <IconButton
          className="disabled:cursor-not-allowed disabled:opacity-40"
          label="Previous page"
          disabled={disabled || atStart}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <FiChevronLeft />
        </IconButton>
        <IconButton
          className="disabled:cursor-not-allowed disabled:opacity-40"
          label="Next page"
          disabled={disabled || atEnd}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <FiChevronRight />
        </IconButton>
        {!hasMore && <IconButton
          className="max-sm:hidden disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex"
          label="Last page"
          disabled={disabled || atEnd}
          onClick={() => onPageChange(totalPages)}
        >
          <FiChevronsRight />
        </IconButton>}
      </div>
    </nav>
  );
}
