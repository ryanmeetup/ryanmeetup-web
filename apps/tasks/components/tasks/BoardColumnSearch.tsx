"use client";

import { FiLoader, FiSearch, FiX } from "react-icons/fi";

export function BoardColumnSearch({
  statusName,
  query,
  setQuery,
  isPending,
}: {
  statusName: string;
  query: string;
  setQuery: (query: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="relative">
      <FiSearch
        aria-hidden
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/40 sm:left-3 dark:text-white/40"
      />
      <input
        type="search"
        aria-label={`Search ${statusName} tasks`}
        aria-busy={isPending}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${statusName}...`}
        className="h-8 w-full rounded-lg border border-black/10 bg-white pl-8 pr-8 text-xs outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10 sm:h-9 sm:pl-9 sm:pr-9 sm:text-sm dark:border-white/10 dark:bg-white/5 dark:focus:border-white/30 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {isPending && (
        <FiLoader
          aria-label={`Filtering ${statusName} tasks`}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-black/45 motion-reduce:animate-none sm:right-3 dark:text-white/45"
        />
      )}
      {!isPending && query && (
        <button
          type="button"
          aria-label={`Clear ${statusName} search`}
          onClick={() => setQuery("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-black/55 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:right-3 dark:text-white/55 dark:hover:text-white dark:focus-visible:ring-white/30"
        >
          <FiX aria-hidden />
        </button>
      )}
    </div>
  );
}
