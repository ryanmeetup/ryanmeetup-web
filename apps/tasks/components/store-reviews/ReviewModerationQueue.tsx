"use client";

import { FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import { Button, Card, DropdownSelect, EmptyState, ErrorCallout, ManagementSurface, Spinner, Text } from "@ryanmeetup/ui";
import { isModerationFilter } from "@/lib/store-reviews/moderation";
import type { ModerationAction, ModerationInitialState, PublishAction } from "@/lib/store-reviews/moderation";
import { useReviewModeration } from "./useReviewModeration";
import { ReviewModerationCard } from "./ReviewModerationCard";
import { ReviewPhotoDecisionDialog } from "./ReviewPhotoDecisionDialog";
import { ReviewDeletionDialog } from "./ReviewDeletionDialog";
import { ReviewModerationDialog } from "./ReviewModerationDialog";
import { ReviewReplyDialog } from "./ReviewReplyDialog";

// Not a Shopify product ID, which is always numeric.
const ALL_PRODUCTS = "all";

export function ReviewModerationQueue({ initial, staffNames }: { initial: ModerationInitialState; staffNames: Record<string, string> }) {
  const queue = useReviewModeration(initial);
  if (queue.disabled) return <Card><Text>Store review moderation is not enabled for this workspace.</Text></Card>;
  const products = queue.page?.products ?? [];
  const locked = Boolean(queue.busy || queue.selection);
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
      {queue.busy ? <span className="inline-flex items-center gap-2"><Spinner size={16} />{queue.busy === "saving" ? "Saving decision and refreshing reviews…" : "Loading reviews…"}</span> : queue.message}
    </div>
    {queue.error && <ErrorCallout>{queue.error}</ErrorCallout>}
    <div aria-label="Review queue" aria-busy={Boolean(queue.busy)} className={`grid items-start gap-4 @3xl:grid-cols-2 ${queue.busy ? "opacity-60" : ""}`}>
      {queue.page?.reviews.map((review) => <ReviewModerationCard key={`${review.id}-${review.updatedAt}`}
        review={review} staffNames={staffNames} disabled={Boolean(queue.busy)} onSelect={queue.select} onPhotoSelect={queue.selectPhoto} />)}
      {queue.page?.reviews.length === 0 && <EmptyState className="col-span-full" message={queue.filter === "pending" ? "No reviews waiting for a decision" :
        queue.filter === "rejected" ? "No rejected reviews" : "No reviews in this queue"} />}
    </div>
    {queue.page?.next && <Button className="w-full sm:w-auto" variant="secondary" disabled={locked} onClick={() => void queue.load({ more: true })}>Load more reviews</Button>}
    {queue.selection && "photo" in queue.selection ? <ReviewPhotoDecisionDialog selection={queue.selection} saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} /> :
    queue.selection?.action === "delete" ? <ReviewDeletionDialog key={`${queue.selection.review.id}-delete`} review={queue.selection.review}
      saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} /> :
    queue.selection && (queue.selection.action === "reply-set" || queue.selection.action === "reply-remove" ?
      <ReviewReplyDialog key={`${queue.selection.review.id}-${queue.selection.action}`} review={queue.selection.review}
        remove={queue.selection.action === "reply-remove"} saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} /> :
      <ReviewModerationDialog key={`${queue.selection.review.id}-${queue.selection.action}`}
        selection={{ action: queue.selection.action as Exclude<ModerationAction, PublishAction>, review: queue.selection.review }}
        saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} />)}
    </div>
  </ManagementSurface>;
}
