"use client";

import { useCallback, useEffect } from "react";
import { useQueryParamState } from "./useQueryParamState";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

type PaginationOptions = {
  /** URL parameter for the 1-based page number. */
  pageParam?: string;
  /** URL parameter for the page size. */
  pageSizeParam?: string;
  defaultPageSize?: number;
  /** The sizes a reader may choose; a remembered size outside this list is ignored. */
  pageSizeOptions?: readonly number[];
  /** Where a chosen page size is remembered in this browser; null remembers nothing. */
  storageKey?: string | null;
};

/** Page and page size kept in the URL, so a list view stays shareable, with the reader's page size remembered. */
const usePagination = ({
  pageParam = "page",
  pageSizeParam = "pageSize",
  defaultPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  storageKey = "ryanmeetup.pagination.page-size",
}: PaginationOptions = {}) => {
  const [pageValue, setPageParam] = useQueryParamState(pageParam, "1");
  const [pageSizeValue, setPageSizeParam] = useQueryParamState(
    pageSizeParam,
    String(defaultPageSize),
  );
  const maxPageSize = Math.max(defaultPageSize, ...pageSizeOptions);
  const page = Math.max(1, Number.parseInt(pageValue, 10) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number.parseInt(pageSizeValue, 10) || defaultPageSize),
  );

  useEffect(() => {
    if (!storageKey) return;
    if (new URLSearchParams(window.location.search).has(pageSizeParam)) return;
    let saved = Number.NaN;
    try {
      saved = Number.parseInt(localStorage.getItem(storageKey) ?? "", 10);
    } catch {
      return;
    }
    if (!pageSizeOptions.includes(saved)) return;
    queueMicrotask(() => setPageSizeParam(String(saved)));
  }, [pageSizeOptions, pageSizeParam, setPageSizeParam, storageKey]);

  const setPage = useCallback(
    (value: number) => setPageParam(String(value)),
    [setPageParam],
  );
  const setPageSize = useCallback(
    (value: number) => {
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(value));
        } catch {
          // A blocked store only loses the remembered size.
        }
      }
      setPageSizeParam(String(value));
      setPageParam("1");
    },
    [setPageParam, setPageSizeParam, storageKey],
  );
  const syncPageSize = useCallback(
    (value: number) => setPageSizeParam(String(value)),
    [setPageSizeParam],
  );

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    syncPage: setPage,
    syncPageSize,
  };
};

export { usePagination };
export type { PaginationOptions };
