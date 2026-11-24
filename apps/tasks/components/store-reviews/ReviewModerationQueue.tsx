"use client";

import { useEffect, useEffectEvent } from "react";
import { FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import { usePagination, useSearchFilter } from "@ryanmeetup/hooks";
import { Button, Card, DropdownSelect, EmptyState, ErrorCallout, FilterBar, ManagementSurface, Pagination, PendingResults, SearchInput, Spinner, Text } from "@ryanmeetup/ui";
import { derivePagination } from "@ryanmeetup/utils";
import { isModerationFilter, moderationReviewSearchText } from "@/lib/store-reviews/moderation";
import type { ModerationAction, ModerationInitialState, PublishAction } from "@/lib/store-reviews/moderation";
import { useReviewModeration } from "./useReviewModeration";
import { ReviewModerationTable } from "./ReviewModerationTable";
import { ReviewPhotoDecisionDialog } from "./ReviewPhotoDecisionDialog";
import { ReviewDeletionDialog } from "./ReviewDeletionDialog";
import { ReviewModerationDialog } from "./ReviewModerationDialog";
import { ReviewReplyDialog } from "./ReviewReplyDialog";
import { ReviewBulkActions } from "./ReviewBulkActions";

// Not a Shopify product ID, which is always numeric.
const ALL_PRODUCTS = "all";

export function ReviewModerationQueue({ initial, staffNames }: { initial: ModerationInitialState; staffNames: Record<string, string> }) {
  const queue = useReviewModeration(initial);
  const { page: requestedPage, pageSize, setPage, setPageSize } = usePagination();
  const { query, setQuery, filtered, isPending: searchPending } = useSearchFilter({
    data: queue.page?.reviews ?? [], buildHaystack: moderationReviewSearchText, queryParam: "search",
  });
  const { page, from, to } = derivePagination(requestedPage, pageSize, filtered.length);
  const reviews = filtered.slice(from, to + 1);
  const searching = query.trim().length > 0;
  const fillPage = useEffectEvent(() => {
    if (!searching && queue.page?.next && !queue.busy && !queue.error &&
      queue.page.reviews.length < requestedPage * pageSize) {
      void queue.load({ more: true, minimumReviews: requestedPage * pageSize });
    }
  });
  useEffect(() => { fillPage(); }, [requestedPage, pageSize, queue.page]);
  if (queue.disabled) return <Card><Text>Store review moderation is not enabled for this workspace.</Text></Card>;
  const products = queue.page?.products ?? [];
  const locked = Boolean(queue.busy || queue.selection || queue.bulkSelection);
  // The queue's own count, unless a search narrows it to the loaded matches.
  const total = searching ? null : queue.page?.total ?? null;
  async function changePage(next: number) {
    if (locked || searchPending) return;
    queue.clearSelected();
    if (next * pageSize > filtered.length && queue.page?.next) {
      // The API uses cursors. Fetch enough rows for the requested display page;
      // a search needs the remaining rows before it can locate the next matches.
      if (!await queue.load({ more: true, minimumReviews: searching ? Infinity : next * pageSize })) return;
    }
    setPage(next);
  }
  async function changePageSize(next: number) {
    if (locked || searchPending) return;
    queue.clearSelected();
    if (next > filtered.length && queue.page?.next && !await queue.load({ more: true, minimumReviews: searching ? Infinity : next })) return;
    setPageSize(next);
  }
  return <ManagementSurface
    title={<><FiMessageSquare aria-hidden className="mr-2 inline-block align-middle text-black/40 dark:text-white/40" />Store Reviews</>}
    description="Review buyer submissions, photos, and public replies."
    actions={<Button size="sm" variant="secondary" className="w-full sm:w-auto" leftIcon={<FiRefreshCw aria-hidden />}
      disabled={locked} onClick={() => { setPage(1); void queue.load(); }}>Refresh queue</Button>}>
    <div className="@container space-y-4">
      <FilterBar inlineFrom="xl" search={<SearchInput label="Search reviews" name="search" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }}
        placeholder="Search by product, reviewer, or review text..." pending={searchPending} pendingLabel="Loading review results" />}
        actions={<div className="flex flex-col gap-3 sm:flex-row">
        <DropdownSelect label="Queue" variant="compact" value={queue.filter} disabled={locked}
          options={[{ value: "pending", label: "Waiting for review" }, { value: "published", label: "Published" },
            { value: "hidden", label: "Hidden" }, { value: "rejected", label: "Rejected" }, { value: "all", label: "All reviews" }]}
          onChange={(value) => { if (isModerationFilter(value)) { setPage(1); void queue.load({ filter: value }); } }} />
        {(products.length > 1 || queue.productId) && <DropdownSelect label="Product" variant="compact" value={queue.productId ?? ALL_PRODUCTS}
          disabled={locked}
          options={[{ value: ALL_PRODUCTS, label: "All products" }, ...products.map((product) => ({ value: product.productId, label: product.productTitle }))]}
          onChange={(value) => { setPage(1); void queue.load({ productId: value === ALL_PRODUCTS ? null : value }); }} />}
      </div>} />
    <Text className="text-sm">{queue.filter === "rejected"
      ? "Rejected text is kept, never deleted. Publish anyway puts it live, as long as the buyer has not written a newer version."
      : "Newest first, across every rating. Approve text and photos separately; published content stays live while edits wait."}</Text>
    <div role="status" aria-live="polite" className="text-sm text-black/70 empty:hidden dark:text-white/70">
      {/* A saved decision is announced by its toast; repeating it here only left a stale line behind. */}
      {queue.busy && <span className="inline-flex items-center gap-2"><Spinner size={16} />{queue.bulkProgress
        ? `Saving bulk action: ${queue.bulkProgress.completed} of ${queue.bulkProgress.total} reviews processed…`
        : queue.busy === "saving" ? "Saving decision and refreshing reviews…" : "Loading reviews…"}</span>}
    </div>
    {queue.error && <ErrorCallout>{queue.error}</ErrorCallout>}
    {reviews.length > 0 && <ReviewBulkActions reviews={reviews} selectedIds={queue.selectedIds}
      disabled={locked || searchPending} searching={searching} onToggleAll={() => queue.toggleAll(reviews)} onClear={queue.clearSelected}
      onAction={(action) => queue.selectBulk(action, reviews)} />}
    <PendingResults pending={searchPending} label="Loading reviews">
    <div aria-label="Review queue" aria-busy={Boolean(queue.busy) || searchPending} className={queue.busy ? "opacity-60" : ""}>
      {reviews.length > 0 && <ReviewModerationTable reviews={reviews} staffNames={staffNames}
        disabled={locked} selectedIds={queue.selectedIds} onToggleReview={queue.toggleReview} onSelect={queue.select} onPhotoSelect={queue.selectPhoto} />}
      {queue.page && reviews.length === 0 && <EmptyState message={searching ? `No loaded reviews match “${query.trim()}”` :
        queue.filter === "pending" ? "No reviews waiting for a decision" :
        queue.filter === "rejected" ? "No rejected reviews" : "No reviews in this queue"} />}
    </div>
    </PendingResults>
    {/* Search runs over the reviews already loaded; say so while more pages exist so a miss is not read as "none". */}
    {searching && queue.page?.next && <Text className="text-sm">Searching loaded reviews only. Use Next page to search further back.</Text>}
    {queue.page && <Pagination page={page} pageSize={pageSize} totalCount={total ?? filtered.length} hasMore={total === null && Boolean(queue.page.next)}
      itemLabel="reviews" itemLabelSingular="review" disabled={locked || searchPending} onPageChange={(next) => void changePage(next)} onPageSizeChange={(next) => void changePageSize(next)} />}
    {queue.selection && "photo" in queue.selection ? <ReviewPhotoDecisionDialog selection={queue.selection} saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} /> :
    queue.selection?.action === "delete" ? <ReviewDeletionDialog key={`${queue.selection.review.id}-delete`} reviews={[queue.selection.review]}
      saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} /> :
    queue.selection && (queue.selection.action === "reply-set" || queue.selection.action === "reply-remove" ?
      <ReviewReplyDialog key={`${queue.selection.review.id}-${queue.selection.action}`} review={queue.selection.review}
        remove={queue.selection.action === "reply-remove"} saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} /> :
      <ReviewModerationDialog key={`${queue.selection.review.id}-${queue.selection.action}`}
        selection={{ action: queue.selection.action as Exclude<ModerationAction, PublishAction>, reviews: [queue.selection.review] }}
        saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} />)}
    {queue.bulkSelection && (queue.bulkSelection.action === "delete"
      ? <ReviewDeletionDialog reviews={queue.bulkSelection.reviews} saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decideBulk} />
      : <ReviewModerationDialog selection={{ action: queue.bulkSelection.action as Exclude<ModerationAction, PublishAction>, reviews: queue.bulkSelection.reviews }}
        saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decideBulk} />)}
    </div>
  </ManagementSurface>;
}
