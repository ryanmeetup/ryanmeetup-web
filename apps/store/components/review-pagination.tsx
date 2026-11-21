"use client";

import { Pagination } from "@ryanmeetup/ui";
import { REVIEW_PAGE_SIZE_OPTIONS } from "@/lib/public-review-view";

/**
 * The shared list pagination under review cards. Changing page returns the
 * reader to the top of the results, since the new cards replace the old ones.
 */
export function ReviewPagination({ resultsId, page, pageSize, total, pending, onPageChange, onPageSizeChange }: {
  resultsId: string;
  page: number;
  pageSize: number;
  total: number;
  pending: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  // Like the Tasks list views, the bar stays whenever there are results, so the count and page size are always in one place.
  if (!total) return null;
  const toResults = () => document.getElementById(resultsId)?.scrollIntoView({ block: "start", behavior: "instant" });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <>
    <Pagination page={page} pageSize={pageSize} totalCount={total} itemLabel="reviews" itemLabelSingular="review" pageSizeLabel="Per page"
      pageSizeOptions={REVIEW_PAGE_SIZE_OPTIONS} inset={false} disabled={pending} className="mt-8"
      onPageChange={(next) => { onPageChange(next); toResults(); }}
      onPageSizeChange={(next) => { onPageSizeChange(next); toResults(); }} />
    <div role="status" aria-live="polite" className="sr-only">{pending ? "" : `Page ${Math.min(page, pages)} of ${pages}`}</div>
  </>;
}
