"use client";

import type { BuyerReviewStatus } from "@ryanmeetup/reviews";
import { Button, Card, ConfirmationDialog, ErrorCallout, Heading, IconButton, Pill, RatingStars, Spinner, Text } from "@ryanmeetup/ui";
import { FiEdit2, FiMessageSquare, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { buyerReviewNameChoices } from "@/lib/my-review-view";
import { reviewSignInRel, reviewSignInUrl } from "@/lib/review-sign-in";
import type { MyReviewView } from "@/lib/my-review-view";
import type { ReviewSuggestions as Suggestions } from "@/lib/review-suggestions";
import { CustomReviewComposer } from "./custom-review-composer";
import { ReviewSuggestions } from "./review-suggestions";
import { useMyReviews } from "./use-my-reviews";

const STATUS: Record<BuyerReviewStatus, { label: string; note: string }> = {
  pending: { label: "Waiting for approval", note: "We check every review before it goes up." },
  published: { label: "Published", note: "Live on the product page." },
  rejected: { label: "Not approved", note: "This one didn't go up. You can edit it and try again, or withdraw it." },
  hidden: { label: "Hidden", note: "We've taken this off the product page. You can withdraw it here." },
  withdrawn: { label: "Withdrawn", note: "Removed by you. Write a new review from the product page whenever you like." },
};


/** Only canonical reloaded data enables another buyer action. */
export function MyReviews({ initial, suggestions }: { initial: MyReviewView | null; suggestions?: Suggestions | null }) {
  const mine=useMyReviews(initial);
  const editing=mine.editing;
  const hasSuggestions=Boolean(suggestions?.items.length);
  return <div className="space-y-10">
    {suggestions && <ReviewSuggestions suggestions={suggestions} onReviewed={(notice)=>void mine.reloadWith(notice)} />}
    <section aria-labelledby={hasSuggestions ? "your-reviews" : undefined} className="space-y-4">
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-black/10 pb-3 dark:border-white/10">
      {hasSuggestions ? <Heading id="your-reviews" size="h2" className="text-2xl">Your reviews</Heading> : <span />}
      <div className="flex shrink-0 items-center gap-2">
        {!mine.view && <Button.Link href={reviewSignInUrl("/reviews/mine")} rel={reviewSignInRel} prefetch={false} size="sm" variant="secondary">Sign in</Button.Link>}
        <Button variant="ghost" size="sm" disabled={mine.pending || Boolean(editing || mine.withdrawing)} onClick={()=>void mine.load()}
          leftIcon={<FiRefreshCw aria-hidden className={mine.pending ? "animate-spin motion-reduce:animate-none" : ""} />}>Refresh reviews</Button>
      </div>
    </div>
    <div role="status" aria-live="polite" className="text-sm text-black/70 dark:text-white/70">
      {mine.pending ? <span className="inline-flex items-center gap-2"><Spinner size={16} className="shrink-0" />Updating your reviews…</span> : mine.message}
    </div>
    {mine.error && <ErrorCallout>{mine.error}</ErrorCallout>}
    <div aria-busy={mine.pending} className={mine.pending ? "opacity-60" : ""}>
      {mine.view?.page.reviews.length===0 && hasSuggestions && <Text className="text-sm">Reviews you write show up here, ready to edit.</Text>}
      {mine.view?.page.reviews.length===0 && !hasSuggestions && <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20 sm:p-10">
        <FiMessageSquare aria-hidden className="mx-auto size-6 text-black/60 dark:text-white/60" />
        <Heading size="h2" className="mt-3 text-xl">No reviews yet</Heading>
        <Text className="mx-auto mt-2 max-w-md">Got some Ryan gear? Write a review on its product page and it&apos;ll show up here, ready to edit.</Text>
        <Button.Link href="/" size="md" className="mt-6 w-full sm:w-auto">Browse the shop</Button.Link>
      </div>}
      <ul aria-label="Your reviews" className="space-y-4">
        {mine.view?.page.reviews.map((review)=>{
          const status=STATUS[review.status];
          return <li key={`${review.id}-${review.updatedAt}`}>
            <Card size="lg" variant="outline">
              <article aria-label={`Your review of ${review.item.productTitle}`} data-testid={`my-review-${review.id}`} className="min-w-0 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><Heading size="h3" className="text-xl wrap-anywhere">{review.item.productTitle}</Heading>
                    {review.item.variantTitle && <Text className="text-sm wrap-anywhere">{review.item.variantTitle}</Text>}</div>
                  <Pill className="self-start shrink-0" variant={review.status==="published"?"success":"neutral"} size="sm">{status.label}</Pill>
                </div>
                <RatingStars rating={review.current.rating} />
                {review.current.title && <Heading size="h4" className="text-lg wrap-anywhere">{review.current.title}</Heading>}
                <Text className="whitespace-pre-wrap wrap-anywhere">{review.current.body}</Text>
                <Text className="text-sm wrap-anywhere">Shown as <span className="font-semibold">{review.current.displayName}</span>. {review.hasPendingEdit ? "Your latest edit is waiting for approval; the published version stays up until then." : status.note}</Text>
                {review.status!=="withdrawn" && <div className="flex gap-2">
                  {review.status!=="hidden" && <IconButton size="md" label={`Edit your review of ${review.item.productTitle}`} disabled={mine.pending} onClick={()=>mine.select(review,"edit")}><FiEdit2 aria-hidden /></IconButton>}
                  <IconButton size="md" variant="danger" label={`Withdraw your review of ${review.item.productTitle}`} disabled={mine.pending} onClick={()=>mine.select(review,"withdraw")}><FiTrash2 aria-hidden /></IconButton>
                </div>}
              </article>
            </Card>
          </li>;
        })}
      </ul>
    </div>
    {mine.view?.page.nextCursor && <Button className="w-full sm:w-auto" variant="secondary" disabled={mine.pending} onClick={()=>void mine.load(true)}>Load more reviews</Button>}
    </section>
    {editing && <CustomReviewComposer key={`${editing.id}-${editing.updatedAt}`} open
      access={{status:"ready",buyer:{firstName:null,lastName:null},purchases:editing.lineId?[{lineId:editing.lineId,label:editing.item.variantTitle ? `${editing.item.productTitle} · ${editing.item.variantTitle}`:editing.item.productTitle}]:[],defaultNameStyle:editing.current.nameStyle}}
      product={{title:editing.item.productTitle,featuredImage:null}}
      edit={{initial:editing.current,nameChoices:buyerReviewNameChoices(editing,mine.view?.buyerName??null)}}
      onClose={mine.dismiss} onSubmit={(review)=>mine.save(editing,{rating:review.rating,title:review.title,body:review.body,nameStyle:review.nameStyle})} />}
    <ConfirmationDialog open={Boolean(mine.withdrawing)} setOpen={(open)=>{if(!open)mine.dismiss();}}
      title="Withdraw this review?" description="It comes off the product page and out of rating totals. To write again, return to the product page."
      confirmLabel="Withdraw" pendingLabel="Withdrawing…" pending={mine.pending} onConfirm={()=>mine.withdrawing&&mine.save(mine.withdrawing)} />
  </div>;
}
