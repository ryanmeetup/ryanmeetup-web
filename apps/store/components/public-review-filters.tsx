"use client";

import { Button, DropdownSelect } from "@ryanmeetup/ui";
import { REVIEW_ORIGIN_OPTIONS, REVIEW_RATING_OPTIONS, REVIEW_SORT_OPTIONS } from "@/lib/public-review-view";

type ReviewView = { rating: string; sort: string; origin: string };

/** Keep the public feed and product review controls consistent. */
export function PublicReviewFilters({ rating, sort, origin, onChange }: ReviewView & {
  onChange: (view: Partial<ReviewView>) => void;
}) {
  return <div role="group" aria-label="Filter and sort reviews" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <DropdownSelect label="Rating" variant="compact" options={REVIEW_RATING_OPTIONS} value={rating}
      onChange={(rating) => onChange({ rating })} active={rating !== "all"}
      searchPlaceholder="Search by rating..." className="w-full sm:w-auto" />
    <DropdownSelect label="Source" variant="compact" options={REVIEW_ORIGIN_OPTIONS} value={origin}
      onChange={(origin) => onChange({ origin })} active={origin !== "all"}
      searchPlaceholder="Search by source..." className="w-full sm:w-auto" />
    <DropdownSelect label="Sort" variant="compact" options={REVIEW_SORT_OPTIONS} value={sort}
      onChange={(sort) => onChange({ sort })} active={sort !== "newest"}
      searchPlaceholder="Search by sort order..." className="w-full sm:w-auto" />
    {(rating !== "all" || sort !== "newest" || origin !== "all") && <Button variant="ghost" size="sm" className="w-full sm:w-auto"
      onClick={() => onChange({ rating: "all", sort: "newest", origin: "all" })}>Reset filters</Button>}
  </div>;
}
