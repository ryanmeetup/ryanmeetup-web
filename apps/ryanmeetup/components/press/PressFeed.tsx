"use client";

import { useMemo, useState } from "react";

// Components
import { Article } from "@/components/press";
import {
  Card,
  EmptyState,
  FilterChipGroup,
  FilterBar,
  Input,
  Text,
} from "@ryanmeetup/ui";
import { CollapsibleYearSection, SearchIndicator } from "@/components/global";

// Types
import type { Article as RyanArticle } from "@/lib/types";

// Utilities
import { useQueryParamState, useSearchFilter } from "@ryanmeetup/hooks";

type PressFeedProps = {
  articles: RyanArticle[];
};

const buildArticleSearchText = (article: RyanArticle) =>
  JSON.stringify(article).toLowerCase();

const getYear = (article: RyanArticle) => {
  const date = new Date(article.publishedOn ?? article.publishDate);
  return Number.isNaN(date.getTime()) ? "Unknown" : String(date.getFullYear());
};

const PressFeed = (props: PressFeedProps) => {
  const { articles } = props;
  const [activeOutlet, setActiveOutlet] = useQueryParamState("outlet", "All");
  const [activeYear, setActiveYear] = useQueryParamState("year", "All");
  const [showFilters, setShowFilters] = useState(false);
  const {
    query,
    setQuery,
    filtered: searchedArticles,
    isPending: isSearchPending,
  } = useSearchFilter({
    data: articles,
    buildHaystack: buildArticleSearchText,
  });

  const outletOptions = useMemo(() => {
    const outlets = new Set(
      articles.map((article) => article.outlet).filter(Boolean),
    );
    return ["All", ...Array.from(outlets).sort()];
  }, [articles]);

  const yearOptions = useMemo(() => {
    const years = new Set(articles.map(getYear));
    return [
      "All",
      ...Array.from(years)
        .filter((year) => year !== "Unknown")
        .sort()
        .reverse(),
    ];
  }, [articles]);

  const filtered = useMemo(() => {
    return searchedArticles.filter((article) => {
      if (activeOutlet !== "All" && article.outlet !== activeOutlet) {
        return false;
      }
      if (activeYear !== "All" && getYear(article) !== activeYear) {
        return false;
      }
      return true;
    });
  }, [searchedArticles, activeOutlet, activeYear]);

  const groupedByYear = useMemo(() => {
    return filtered.reduce<Record<string, RyanArticle[]>>((acc, article) => {
      const year = getYear(article);
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(article);
      return acc;
    }, {});
  }, [filtered]);

  const orderedYears = useMemo(() => {
    return Object.keys(groupedByYear)
      .filter((year) => year !== "Unknown")
      .sort()
      .reverse();
  }, [groupedByYear]);

  return (
    <div>
      <FilterBar
        className="mb-6"
        search={
          <Input
            label="Search articles"
            name="article-search"
            placeholder="Search by title, author, outlet, or keyword..."
            leadingIcon={<SearchIndicator isPending={isSearchPending} />}
            inputClassName="pr-4"
            onChange={(event) => setQuery(event.target.value)}
            value={query}
          />
        }
      />

      <div className="flex items-center justify-between">
        <Text className="text-xs font-semibold uppercase tracking-caps-wide text-black/70 dark:text-white/70">
          Filter articles
        </Text>
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-caps text-black/70 transition hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/10 dark:bg-white/10 dark:text-white/70 dark:hover:border-white/40 dark:focus-visible:ring-white/30"
          aria-expanded={showFilters}
        >
          {showFilters ? "Hide filters" : "Show filters"}
        </button>
      </div>

      {showFilters && (
        <Card variant="soft" size="sm" className="mt-4 space-y-4">
          <FilterChipGroup
            label="Filter by outlet"
            options={outletOptions}
            value={activeOutlet}
            onChange={setActiveOutlet}
          />
          <FilterChipGroup
            label="Filter by year"
            options={yearOptions}
            value={activeYear}
            onChange={setActiveYear}
          />
        </Card>
      )}

      <div className="relative mt-8">
        <div className="absolute left-3 top-0 h-full w-px bg-black/10 dark:bg-white/10" />
        <div className="space-y-10">
          {orderedYears.map((year) => (
            <CollapsibleYearSection
              key={year}
              id={`press-articles-${year}`}
              year={year}
              countLabel={`${groupedByYear[year].length} articles`}
              className="space-y-6"
              headerClassName="pl-10"
              headingClassName="text-5xl title"
              dividerClassName="left-10"
              panelClassName="space-y-8"
              iconClassName="h-4 w-4"
              leadingMarker={
                <div className="absolute left-2 top-1 h-3 w-3 rounded-full border border-black/20 bg-white dark:border-white/20 dark:bg-black" />
              }
            >
              {groupedByYear[year].map((article) => (
                <div key={article.href} className="relative pl-10">
                  <div className="absolute left-2 top-6 h-3 w-3 rounded-full border border-black/20 bg-white dark:border-white/20 dark:bg-black" />
                  <Article article={article} />
                </div>
              ))}
            </CollapsibleYearSection>
          ))}
        </div>
      </div>
      {filtered.length === 0 && (
        <EmptyState
          className="mt-6"
          message="No articles match your search and filters."
        />
      )}
    </div>
  );
};

export { PressFeed };
