"use client";

import { FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import { Button, Card, DropdownSelect, EmptyState, ErrorCallout, ManagementSurface, Spinner, Text } from "@ryanmeetup/ui";
import { isModerationFilter } from "@/lib/store-reviews/moderation";
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
  if (queue.disabled) return <Card><Text>Store review moderation is not enabled for this workspace.</Text></Card>;
  const products = queue.page?.products ?? [];
  const locked = Boolean(queue.busy || queue.selection || queue.bulkSelection);
  return <ManagementSurface
    title={<><FiMessageSquare aria-hidden className="mr-2 inline-block align-middle text-black/40 dark:text-white/40" />Store Reviews</>}
    description="Review buyer submissions, photos, and public replies."
    actions={<Button size="sm" variant="secondary" className="w-full sm:w-auto" leftIcon={<FiRefreshCw aria-hidden />}
      disabled={locked} onClick={() => void queue.load()}>Refresh queue</Button>}>
    <div className="@container space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <DropdownSelect label="Queue" variant="compact" value={queue.filter} disabled={locked}
          options={[{ value: "pending", label: "Waiting for review" }, { value: "published", label: "Published" },
            { value: "hidden", label: "Hidden" }, { value: "rejected", label: "Rejected" }, { value: "all", label: "All reviews" }]}
          onChange={(value) => { if (isModerationFilter(value)) void queue.load({ filter: value }); }} />
        {(products.length > 1 || queue.productId) && <DropdownSelect label="Product" variant="compact" value={queue.productId ?? ALL_PRODUCTS}
          disabled={locked}
          options={[{ value: ALL_PRODUCTS, label: "All products" }, ...products.map((product) => ({ value: product.productId, label: product.productTitle }))]}
          onChange={(value) => void queue.load({ productId: value === ALL_PRODUCTS ? null : value })} />}
      </div>
    <Text className="text-sm">{queue.filter === "rejected"
      ? "Rejected text is kept, never deleted. Publish anyway puts it live, as long as the buyer has not written a newer version."
      : "Oldest first, across every rating. Approve text and photos separately; published content stays live while edits wait."}</Text>
    <div role="status" aria-live="polite" className="text-sm text-black/70 empty:hidden dark:text-white/70">
      {/* A saved decision is announced by its toast; repeating it here only left a stale line behind. */}
      {queue.busy && <span className="inline-flex items-center gap-2"><Spinner size={16} />{queue.bulkProgress
        ? `Saving bulk action: ${queue.bulkProgress.completed} of ${queue.bulkProgress.total} reviews processed…`
        : queue.busy === "saving" ? "Saving decision and refreshing reviews…" : "Loading reviews…"}</span>}
    </div>
    {queue.error && <ErrorCallout>{queue.error}</ErrorCallout>}
    {queue.page && queue.page.reviews.length > 0 && <ReviewBulkActions reviews={queue.page.reviews} selectedIds={queue.selectedIds}
      disabled={locked} onToggleAll={queue.toggleAll} onClear={queue.clearSelected} onAction={queue.selectBulk} />}
    <div aria-label="Review queue" aria-busy={Boolean(queue.busy)} className={queue.busy ? "opacity-60" : ""}>
      {queue.page && queue.page.reviews.length > 0 && <ReviewModerationTable reviews={queue.page.reviews} staffNames={staffNames}
        disabled={locked} selectedIds={queue.selectedIds} onToggleReview={queue.toggleReview} onSelect={queue.select} onPhotoSelect={queue.selectPhoto} />}
      {queue.page?.reviews.length === 0 && <EmptyState message={queue.filter === "pending" ? "No reviews waiting for a decision" :
        queue.filter === "rejected" ? "No rejected reviews" : "No reviews in this queue"} />}
    </div>
    {queue.page?.next && <Button className="w-full sm:w-auto" variant="secondary" disabled={locked} onClick={() => void queue.load({ more: true })}>Load more reviews</Button>}
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
