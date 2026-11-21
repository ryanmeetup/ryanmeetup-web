"use client";

import { Button, DropdownSelect } from "@ryanmeetup/ui";
import { REVIEW_RATING_OPTIONS, REVIEW_SORT_OPTIONS } from "@/lib/public-review-view";

/** Keep the public feed and product review controls consistent. */
export function PublicReviewFilters({ rating, sort, onChange }: {
  rating: string;
  sort: string;
  onChange: (view: { rating?: string; sort?: string }) => void;
}) {
  return <div role="group" aria-label="Filter and sort reviews" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <DropdownSelect label="Rating" variant="compact" options={REVIEW_RATING_OPTIONS} value={rating}
      onChange={(rating) => onChange({ rating })} active={rating !== "all"}
      searchPlaceholder="Search by rating..." className="w-full sm:w-auto" />
    <DropdownSelect label="Sort" variant="compact" options={REVIEW_SORT_OPTIONS} value={sort}
      onChange={(sort) => onChange({ sort })} active={sort !== "newest"}
      searchPlaceholder="Search by sort order..." className="w-full sm:w-auto" />
    {(rating !== "all" || sort !== "newest") && <Button variant="ghost" size="sm" className="w-full sm:w-auto"
      onClick={() => onChange({ rating: "all", sort: "newest" })}>Reset filters</Button>}
  </div>;
}
