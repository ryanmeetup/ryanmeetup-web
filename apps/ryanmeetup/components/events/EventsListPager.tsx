"use client";

import { useCallback, useMemo, useEffect, useRef } from "react";
import type { ReactNode } from "react";

// Components
import { EmptyState, Pagination } from "@ryanmeetup/ui";
import { UpcomingEventsList } from "@/components/events";
import { EventsEmptyTable } from "@/components/events/EventsEmptyTable";
import {
  FaGrip as DetailsIcon,
  FaListUl as SummaryIcon,
} from "react-icons/fa6";

// Utilities
import { getEventEmptyMessage, getSortedEventsByView } from "@/utils/events";
import { formatEventCount } from "@/utils/date";
import type { RyanEvent } from "@/lib/types";
import { usePagination, useQueryParamState } from "@ryanmeetup/hooks";

type EventsListPagerProps = {
  events: RyanEvent[];
  view?: "upcoming" | "past";
  /** Page size choices; the first is the default unless `defaultPerPage` names another. */
  perPageOptions?: number[];
  defaultPerPage?: number;
  breadcrumbNode?: ReactNode;
  listTitle?: string;
  ctaLabel?: string;
  sortOrder?: "asc" | "desc";
  emptyStateVariant?: "text" | "table";
  showDisplayModeSwitch?: boolean;
  defaultDisplayMode?: "summary" | "details";
  resetKey?: string | number;
};

const DEFAULT_PER_PAGE_OPTIONS = [5, 10, 25];

const EventsListPager = (props: EventsListPagerProps) => {
  const {
    events,
    view = "upcoming",
    perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
    defaultPerPage,
    breadcrumbNode,
    listTitle,
    ctaLabel,
    sortOrder,
    emptyStateVariant = "text",
    showDisplayModeSwitch = false,
    defaultDisplayMode = "summary",
    resetKey,
  } = props;

  // The shared list pagination keeps the page and size in `page` and `perPage`, as these links always have.
  const { page, pageSize: perPage, setPage, setPageSize } = usePagination({
    pageParam: "page",
    pageSizeParam: "perPage",
    defaultPageSize: defaultPerPage ?? perPageOptions[0],
    pageSizeOptions: perPageOptions,
    storageKey: null,
  });
  const [displayModeParam, setDisplayModeParam] = useQueryParamState(
    "view",
    defaultDisplayMode,
  );
  const displayMode = displayModeParam === "details" ? "details" : "summary";
  const setDisplayMode = useCallback(
    (next: "summary" | "details") => setDisplayModeParam(next),
    [setDisplayModeParam],
  );
  const previousResetKey = useRef(resetKey);

  const sortedEvents = useMemo(
    () => getSortedEventsByView(events, view, sortOrder),
    [events, sortOrder, view],
  );

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = sortedEvents.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );
  // One page at the smallest size needs no paging controls.
  const showPagination = sortedEvents.length > Math.min(...perPageOptions);

  useEffect(() => {
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey;
      setPage(1);
    }
  }, [resetKey, setPage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, setPage, totalPages]);

  const resolvedTitle =
    listTitle ?? (view === "upcoming" ? "Upcoming Events" : "Past Events");
  const resolvedCta = ctaLabel ?? (view === "upcoming" ? "RSVP" : "View event");
  const emptyMessage = getEventEmptyMessage(view);
  const displayModeSwitch = showDisplayModeSwitch ? (
    <div
      className="inline-flex rounded-full border border-black/15 bg-black/5 p-1 shadow-sm dark:border-white/15 dark:bg-white/5"
      aria-label="Event view"
    >
      {[
        {
          value: "summary" as const,
          label: "Summary",
          icon: <SummaryIcon className="h-3.5 w-3.5" />,
        },
        {
          value: "details" as const,
          label: "Details",
          icon: <DetailsIcon className="h-3.5 w-3.5" />,
        },
      ].map((item) => {
        const isActive = displayMode === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => setDisplayMode(item.value)}
            aria-pressed={isActive}
            className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-caps-tight transition ${
              isActive
                ? "bg-black text-white shadow-sm dark:bg-white dark:text-black"
                : "text-black/65 hover:bg-black/10 hover:text-black dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  ) : null;
  return (
    <div className="space-y-4">
      {breadcrumbNode ? (
        <div className="flex items-center">{breadcrumbNode}</div>
      ) : null}

      {sortedEvents.length === 0 ? (
        emptyStateVariant === "table" ? (
          <EventsEmptyTable
            title={resolvedTitle}
            countLabel={formatEventCount(0)}
            message={emptyMessage}
          />
        ) : (
          <EmptyState message={emptyMessage} />
        )
      ) : (
        <UpcomingEventsList
          events={pagedItems}
          title={resolvedTitle}
          sortOrder={sortOrder ?? (view === "upcoming" ? "asc" : "desc")}
          ctaLabel={resolvedCta}
          displayMode={displayMode}
          headerAction={displayModeSwitch}
        />
      )}

      {showPagination && (
        <Pagination
          page={currentPage}
          pageSize={perPage}
          totalCount={sortedEvents.length}
          pageSizeOptions={perPageOptions}
          itemLabel="events"
          pageSizeLabel="Per page"
          inset={false}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
};

export { EventsListPager };
