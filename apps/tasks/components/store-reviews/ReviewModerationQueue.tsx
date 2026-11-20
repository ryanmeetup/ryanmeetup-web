"use client";

import { Button, Card, DropdownSelect, EmptyState, ErrorCallout, Spinner, Text } from "@ryanmeetup/ui";
import { isModerationFilter } from "@/lib/store-reviews/moderation";
import type { ModerationInitialState } from "@/lib/store-reviews/moderation";
import { useReviewModeration } from "./useReviewModeration";
import { ReviewModerationCard } from "./ReviewModerationCard";
import { ReviewModerationDialog } from "./ReviewModerationDialog";
import { ReviewReplyDialog } from "./ReviewReplyDialog";

export function ReviewModerationQueue({ initial, staffNames }: { initial: ModerationInitialState; staffNames: Record<string, string> }) {
  const queue = useReviewModeration(initial);
  if (queue.disabled) return <Card><Text>Store review moderation is not enabled for this workspace.</Text></Card>;
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <DropdownSelect label="Queue" variant="compact" value={queue.filter}
        disabled={Boolean(queue.busy || queue.selection)}
        options={[{ value: "pending", label: "Waiting for review" }, { value: "published", label: "Published" }, { value: "hidden", label: "Hidden" }, { value: "all", label: "All reviews" }]}
        onChange={(value) => { if (isModerationFilter(value)) void queue.load(value); }} />
      <Button variant="secondary" className="w-full sm:w-auto" disabled={Boolean(queue.busy || queue.selection)} onClick={() => void queue.load()}>Refresh queue</Button>
    </div>
    <Text className="text-sm">Oldest first, across every rating. Buyer edits wait for approval while the approved version stays public.</Text>
    <div role="status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">
      {queue.busy ? <span className="inline-flex items-center gap-2"><Spinner size={16} />{queue.busy === "saving" ? "Saving decision and refreshing reviews…" : "Loading reviews…"}</span> : queue.message}
    </div>
    {queue.error && <ErrorCallout>{queue.error}</ErrorCallout>}
    <div aria-label="Review queue" aria-busy={Boolean(queue.busy)} className={`space-y-4 ${queue.busy ? "opacity-60" : ""}`}>
      {queue.page?.reviews.map((review) => <ReviewModerationCard key={`${review.id}-${review.updatedAt}`}
        review={review} staffNames={staffNames} disabled={Boolean(queue.busy)} onSelect={queue.select} />)}
      {queue.page?.reviews.length === 0 && <EmptyState message={queue.filter === "pending" ? "No reviews waiting for a decision" : "No reviews in this queue"} />}
    </div>
    {queue.page?.next && <Button className="w-full sm:w-auto" variant="secondary" disabled={Boolean(queue.busy || queue.selection)} onClick={() => void queue.load(queue.filter, true)}>Load more reviews</Button>}
    {queue.selection && (queue.selection.action === "reply-set" || queue.selection.action === "reply-remove" ?
      <ReviewReplyDialog key={`${queue.selection.review.id}-${queue.selection.action}`} review={queue.selection.review}
        remove={queue.selection.action === "reply-remove"} saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} /> :
      <ReviewModerationDialog key={`${queue.selection.review.id}-${queue.selection.action}`}
        selection={{ action: queue.selection.action, review: queue.selection.review }}
        saving={Boolean(queue.busy)} onClose={queue.dismiss} onSubmit={queue.decide} />)}
  </div>;
}
