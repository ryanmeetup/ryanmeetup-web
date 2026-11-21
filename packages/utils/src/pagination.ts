/** The shared list-pagination defaults; the page size choices match the shared `Pagination` control. */
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const MAX_PAGE_SIZE = 100;

export type PaginationState = {
  page: number;
  pageSize: number;
  totalCount: number;
};

export type PaginationParams = {
  /** URL parameter for the 1-based page number. */
  pageParam?: string;
  /** URL parameter for the page size. */
  pageSizeParam?: string;
  defaultPageSize?: number;
  maxPageSize?: number;
};

function integer(value: string | null, fallback: number) {
  if (!value || !/^-?\d+$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

/** Reads a requested page and a clamped page size; malformed values fall back to the defaults. */
export function parsePagination(
  params: Pick<URLSearchParams, "get">,
  {
    pageParam = "page",
    pageSizeParam = "pageSize",
    defaultPageSize = DEFAULT_PAGE_SIZE,
    maxPageSize = MAX_PAGE_SIZE,
  }: PaginationParams = {},
) {
  return {
    requestedPage: Math.max(1, integer(params.get(pageParam), 1)),
    pageSize: Math.min(
      maxPageSize,
      Math.max(1, integer(params.get(pageSizeParam), defaultPageSize)),
    ),
  };
}

/** Clamps a requested page to the pages that exist and gives its zero-based row range. */
export function derivePagination(
  requestedPage: number,
  pageSize: number,
  totalCount: number,
): PaginationState & { totalPages: number; from: number; to: number } {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const from = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    from,
    to: from + pageSize - 1,
  };
}
