"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DropdownSelect,
  EmptyState,
  FilterBar,
  Input,
} from "@ryanmeetup/ui";
import { SearchIndicator } from "@/components/global";
import { FaSliders as Filters } from "react-icons/fa6";
import { ChapterTile } from "@/components/chapters";
import type { RyanChapter } from "@/lib/types";
import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";

type ChapterDirectoryProps = {
  chapters: RyanChapter[];
  upcomingCities: string[];
};

const ChapterDirectory = (props: ChapterDirectoryProps) => {
  const { chapters, upcomingCities } = props;
  const [stateFilter, setStateFilter] = useQueryParamState("state", "all");
  const [upcomingFilter, setUpcomingFilter] = useQueryParamState("upcoming");
  const onlyUpcoming = upcomingFilter === "true";
  const [showFilters, setShowFilters] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setShowSkeleton(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowSkeleton(true);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [isPending]);

  const normalizedUpcoming = useMemo(
    () => new Set(upcomingCities.map((city) => city.toLowerCase())),
    [upcomingCities],
  );

  const stateOptions = useMemo(() => {
    const unique = new Set(
      chapters.map((chapter) => chapter.state).filter(Boolean),
    );
    return Array.from(unique).sort();
  }, [chapters]);

  const {
    query,
    setQuery,
    filtered: queryFilteredChapters,
    isPending: isSearchPending,
  } = useSearchFilter({
    data: chapters,
    buildHaystack: (chapter) => {
      const city = chapter.city ?? "";
      const state = chapter.state ?? "";
      const combined = state ? `${city}, ${state}` : city;
      return [city, state, combined, chapter.slug].join(" ").toLowerCase();
    },
  });

  const filteredChapters = useMemo(() => {
    return queryFilteredChapters.filter((chapter) => {
      if (stateFilter !== "all" && chapter.state !== stateFilter) {
        return false;
      }

      if (
        onlyUpcoming &&
        !normalizedUpcoming.has((chapter.city ?? "").toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [normalizedUpcoming, onlyUpcoming, queryFilteredChapters, stateFilter]);

  const sortedChapters = useMemo(() => {
    const withUpcoming = filteredChapters.map((chapter, index) => ({
      chapter,
      index,
      hasUpcoming: normalizedUpcoming.has((chapter.city ?? "").toLowerCase()),
    }));

    withUpcoming.sort((a, b) => {
      if (a.hasUpcoming === b.hasUpcoming) {
        return a.index - b.index;
      }
      return a.hasUpcoming ? -1 : 1;
    });

    return withUpcoming.map(({ chapter }) => chapter);
  }, [filteredChapters, normalizedUpcoming]);

  const handleClear = () => {
    startTransition(() => {
      setQuery("");
      setStateFilter("all");
      setUpcomingFilter("");
    });
  };

  return (
    <div className="space-y-6">
      <FilterBar
        search={
          <Input
            label="Search chapters"
            name="chapter-search"
            placeholder="Search by city or state..."
            leadingIcon={<SearchIndicator isPending={isSearchPending} />}
            inputClassName="pr-12 lg:pr-4"
            trailingAction={
              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                aria-label="Toggle filters"
                aria-expanded={showFilters}
                className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/20 bg-white text-black/70 transition hover:border-black/40 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/20 dark:bg-white/10 dark:text-white/70 dark:hover:border-white/40 dark:hover:bg-white/10 dark:focus-visible:ring-white/30"
              >
                <Filters className="h-4 w-4" />
              </button>
            }
            onChange={(event) => {
              const value = event.target.value;
              startTransition(() => {
                setQuery(value);
              });
            }}
            value={query}
          />
        }
        actions={
          <div
            className={`grid w-full grid-cols-2 gap-3 lg:w-auto lg:flex lg:flex-wrap lg:items-end lg:justify-end ${showFilters ? "" : "hidden lg:flex"}`}
          >
            <div className="col-span-2 flex flex-col gap-2 lg:col-auto">
              <DropdownSelect
                label="State"
                variant="field"
                value={stateFilter}
                options={[
                  { label: "All states", value: "all" },
                  ...stateOptions.map((state) => ({
                    label: state,
                    value: state,
                  })),
                ]}
                onChange={(value) => {
                  startTransition(() => {
                    setStateFilter(value);
                  });
                }}
              />
            </div>
            <button
              type="button"
              onClick={() =>
                startTransition(() =>
                  setUpcomingFilter((value) =>
                    value === "true" ? "" : "true",
                  ),
                )
              }
              aria-pressed={onlyUpcoming}
              className={`h-11 w-full rounded-lg border px-4 text-[11px] font-semibold uppercase tracking-caps transition lg:w-auto ${
                onlyUpcoming
                  ? "border-black/50 bg-black text-white dark:border-white/30 dark:bg-white dark:text-black"
                  : "border-black/20 bg-white text-black/70 hover:border-black/40 hover:bg-black/5 dark:border-white/20 dark:bg-white/10 dark:text-white/70 dark:hover:border-white/40 dark:hover:bg-white/10"
              }`}
            >
              <span className="sm:hidden">Upcoming</span>
              <span className="hidden sm:inline">Upcoming Event(s)</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="h-11 w-full rounded-lg border border-black/20 bg-white px-4 text-xs font-semibold text-black/70 transition hover:border-black/40 hover:bg-black/5 dark:border-white/20 dark:bg-white/10 dark:text-white/70 dark:hover:border-white/40 dark:hover:bg-white/10 lg:w-auto"
            >
              Clear
            </button>
          </div>
        }
      />

      {showSkeleton ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`chapter-skeleton-${index}`}
              className="h-32 rounded-2xl border border-black/10 bg-black/5 animate-pulse dark:border-white/10 dark:bg-white/10"
            />
          ))}
        </div>
      ) : sortedChapters.length === 0 ? (
        <EmptyState message="No chapters match your search." />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3 xl:grid-cols-4">
          {sortedChapters.map((chapter, index) => (
            <ChapterTile
              key={index}
              chapter={chapter}
              showBanner={normalizedUpcoming.has(chapter.city.toLowerCase())}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export { ChapterDirectory };
