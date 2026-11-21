"use client";

import Link from "next/link";
import type { BuyerReviewStatus } from "@ryanmeetup/reviews";
import { Avatar, Button, Card, ConfirmationDialog, DisclosureCard, ErrorCallout, Heading, RatingStars, Spinner, Text } from "@ryanmeetup/ui";
import { FiAlertCircle, FiCheckCircle, FiClock, FiEdit2, FiEye, FiEyeOff, FiMessageSquare, FiRefreshCw, FiSlash, FiUser, FiXCircle } from "react-icons/fi";
import type { IconType } from "react-icons";
import { buyerReviewNameChoices } from "@/lib/my-review-view";
import { reviewSignInRel, reviewSignInUrl } from "@/lib/review-sign-in";
import { reviewPermalink } from "@/lib/review-links";
import type { MyReviewView } from "@/lib/my-review-view";
import { variantOptions, type ReviewSuggestions as Suggestions } from "@/lib/review-suggestions";
import { CustomReviewComposer } from "./custom-review-composer";
import { ReviewItemDetails, ReviewItemThumbnail, ReviewItemTitle, reviewItemDate, variantRows } from "./review-item";
import { ReviewSuggestions, SectionTitle, reviewSectionToggle } from "./review-suggestions";
import { useMyReviews, type MyReviewsClient } from "./use-my-reviews";
import { VerifiedBadge } from "./verified-badge";
import type { CustomReviewResult, CustomReviewSubmission } from "./custom-review-composer";
import type { ReviewSuggestion } from "@/lib/review-suggestions";

type Tone = "info" | "success" | "danger" | "warning" | "neutral";
type StatusStyle = { label: string; note: string; tone: Tone; icon: IconType };
const STATUS: Record<BuyerReviewStatus, StatusStyle> = {
  pending: { label: "Waiting for approval", note: "We check every review before it goes up.", tone: "info", icon: FiClock },
  published: { label: "Published", note: "Live on the product page.", tone: "success", icon: FiCheckCircle },
  rejected: { label: "Not approved", note: "This one didn't go up. Edit it and we'll take another look, or withdraw it.", tone: "danger", icon: FiAlertCircle },
  hidden: { label: "Hidden", note: "We've taken this off the product page. You can withdraw it here.", tone: "warning", icon: FiEyeOff },
  withdrawn: { label: "Withdrawn", note: "Removed by you. Write a new review from the product page whenever you like.", tone: "neutral", icon: FiSlash },
};
/** One colour per state, for the status message under the review. */
const toneBox: Record<Tone, string> = {
  info: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-100",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100",
  danger: "border-red-500/35 bg-red-500/10 text-red-800 dark:border-red-400/35 dark:bg-red-950/45 dark:text-red-100",
  warning: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100",
  neutral: "border-black/10 bg-black/[0.03] text-black/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70",
};

/**
 * Staff's note on a rejected revision. On a published review it means the
 * buyer's latest edit was turned down while the earlier version stays live.
 * Static page content, so not an alert.
 */
function RejectionReason({ reason, editRejected }: { reason: string; editRejected: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${toneBox.danger}`}>
      <FiAlertCircle aria-hidden className="mt-0.5 shrink-0 text-base" />
      <div className="min-w-0 space-y-3">
        <p className="font-semibold">{editRejected ? "Your latest edit wasn't approved" : "Not approved"}</p>
        <dl className="space-y-1 border-l-2 border-red-500/35 pl-3 dark:border-red-400/35">
          <dt className="font-semibold">Message from Ryan</dt>
          <dd className="whitespace-pre-wrap wrap-anywhere">{reason}</dd>
        </dl>
        <p className="opacity-80">{editRejected ? "The earlier version stays up. Edit again and we'll take another look." : "Edit it and we'll take another look, or withdraw it."}</p>
      </div>
    </div>
  );
}


/** Only canonical reloaded data enables another buyer action. */
export function MyReviews({ initial, suggestions, client, submitReview }: {
  initial: MyReviewView | null; suggestions?: Suggestions | null;
  /** Dev-only mock transports; the live API is used when omitted. */
  client?: MyReviewsClient; submitReview?: (item: ReviewSuggestion, review: CustomReviewSubmission) => Promise<CustomReviewResult>;
}) {
  const mine=useMyReviews(initial,client);
  const editing=mine.editing;
  const currentSuggestions=mine.view?.viewerKey === initial?.viewerKey ? suggestions : null;
  const hasSuggestions=Boolean(currentSuggestions?.items.length);
  const reviewCount=mine.view?.page.reviews.length ?? 0;
  return <div className="space-y-6">
    {currentSuggestions && mine.view && <ReviewSuggestions key={mine.view.viewerKey} suggestions={currentSuggestions} photoViewerKey={mine.view.photosEnabled ? mine.view.viewerKey : undefined} onReviewed={(notice)=>void mine.reloadWith(notice)} submitReview={submitReview} />}
    <section aria-labelledby="your-reviews">
    <DisclosureCard
      id="your-reviews"
      heading="h2"
      defaultOpen
      className="border-b border-black/10 dark:border-white/10"
      buttonClassName={reviewSectionToggle}
      panelClassName="space-y-4 pb-6"
      summary={<SectionTitle title="Your Reviews" count={`${reviewCount}${mine.view?.page.nextCursor ? "+" : ""} review${reviewCount === 1 ? "" : "s"}`} />}
    >
    <div className="flex items-center justify-between gap-4">
      <div role="status" aria-live="polite" className="min-w-0 text-sm text-black/70 dark:text-white/70">
        {mine.pending ? <span className="inline-flex items-center gap-2"><Spinner size={16} className="shrink-0" />Updating your reviews…</span> : mine.message}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!mine.view && <Button.Link href={reviewSignInUrl("/reviews/mine")} rel={reviewSignInRel} prefetch={false} size="sm" variant="secondary">Sign in</Button.Link>}
        {/* Edits, withdrawals, and new reviews reload the list themselves; this is only the way back after a failed load. */}
        {mine.error && <Button variant="ghost" size="sm" disabled={mine.pending || Boolean(editing || mine.withdrawing)} onClick={()=>void mine.load()}
          leftIcon={<FiRefreshCw aria-hidden className={mine.pending ? "animate-spin motion-reduce:animate-none" : ""} />}>Refresh reviews</Button>}
      </div>
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
      {/* Masonry: cards keep their own height, filling two columns top to bottom. */}
      <ul aria-label="Your Reviews" className="gap-4 lg:columns-2">
        {mine.view?.page.reviews.map((review)=>{
          const status=STATUS[review.status];
          const product=mine.view?.products[review.item.productId];
          // A published review with an edit waiting reads as in progress until it's checked.
          const tone:Tone=review.hasPendingEdit ? "info" : status.tone;
          const StatusIcon=review.hasPendingEdit ? FiClock : status.icon;
          const note=review.hasPendingEdit ? "The published version stays up until we check it." : status.note;
          return <li key={`${review.id}-${review.updatedAt}`} className="mb-4 break-inside-avoid">
            <Card size="lg" variant="outline">
              <article aria-label={`Your review of ${review.item.productTitle}`} data-testid={`my-review-${review.id}`} className="flex min-w-0 flex-col gap-4">
                <div className="flex items-start gap-4">
                  <ReviewItemThumbnail href={product?.href} image={product?.image} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Heading size="h3" className="text-base wrap-anywhere"><ReviewItemTitle href={product?.href}>{review.item.productTitle}</ReviewItemTitle></Heading>
                    <ReviewItemDetails rows={[
                      ...variantRows(variantOptions(review.item.variantTitle, product?.options ?? [])),
                      { label: "Reviewed", value: reviewItemDate.format(new Date(review.createdAt)) },
                    ]} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingStars rating={review.current.rating} />
                    {review.lineId && <VerifiedBadge />}
                  </div>
                  {review.current.title && <Heading size="h4" variant="normal" bold className="text-base tracking-normal wrap-anywhere">{review.current.title}</Heading>}
                  <Text className="whitespace-pre-wrap wrap-anywhere">{review.current.body}</Text>
                </div>
                <div className="space-y-2">
                  {review.rejectionReason
                    ? <RejectionReason reason={review.rejectionReason} editRejected={review.status==="published"} />
                    : <p className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${toneBox[tone]}`}><StatusIcon aria-hidden className="mt-0.5 shrink-0" /><span><span className="font-semibold">{review.hasPendingEdit ? "Edit waiting for approval" : status.label}.</span> {note}</span></p>}
                  {review.status === "published" && product?.href && <Link href={reviewPermalink(product.href, review.id)} prefetch={false}
                    aria-label={`View your review of ${review.item.productTitle}`}
                    className="inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold underline decoration-black/30 underline-offset-4 hover:decoration-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:decoration-white/30 dark:hover:decoration-white dark:focus-visible:ring-white/40">
                    <FiEye aria-hidden />View your review
                  </Link>}
                </div>
                {/* Footer: who the review is shown as, then what the buyer can do. */}
                <div className="-mx-6 -mb-6 flex flex-col gap-3 border-t border-black/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <span aria-hidden className="contents"><Avatar size="md" colorful name={review.current.displayName} icon={review.current.nameStyle==="anonymous" ? <FiUser /> : undefined} /></span>
                    <span className="min-w-0 wrap-anywhere"><span className="block text-xs text-black/60 dark:text-white/60">Posted as</span><span className="font-semibold">{review.current.displayName}</span></span>
                  </div>
                  {review.status!=="withdrawn" && <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {review.status!=="hidden" && <Button size="sm" variant="secondary" fullWidth className="sm:w-auto" aria-label={`Edit your review of ${review.item.productTitle}`} disabled={mine.pending}
                      leftIcon={<FiEdit2 aria-hidden />} onClick={()=>mine.select(review,"edit")}>Edit</Button>}
                    <Button size="sm" variant="ghost" fullWidth className="sm:w-auto" aria-label={`Withdraw your review of ${review.item.productTitle}`} disabled={mine.pending}
                      leftIcon={<FiXCircle aria-hidden />} onClick={()=>mine.select(review,"withdraw")}>Withdraw</Button>
                  </div>}
                </div>
              </article>
            </Card>
          </li>;
        })}
      </ul>
    </div>
    {mine.view?.page.nextCursor && <Button className="w-full sm:w-auto" variant="secondary" disabled={mine.pending} onClick={()=>void mine.load(true)}>Load more reviews</Button>}
    </DisclosureCard>
    </section>
    {editing && <CustomReviewComposer key={`${editing.id}-${editing.updatedAt}`} open
      access={{status:"ready",buyer:{firstName:null,lastName:null},purchases:editing.lineId?[{lineId:editing.lineId,label:editing.item.variantTitle ? `${editing.item.productTitle} · ${editing.item.variantTitle}`:editing.item.productTitle}]:[],defaultNameStyle:editing.current.nameStyle}}
      product={{title:editing.item.productTitle,featuredImage:mine.view?.products[editing.item.productId]?.image ? {...mine.view.products[editing.item.productId].image!,width:null,height:null} : null}}
      edit={{initial:editing.current,nameChoices:buyerReviewNameChoices(editing,mine.view?.buyerName??null)}}
      photos={mine.view?.photosEnabled ? {productId:editing.item.productId,viewerKey:mine.view.viewerKey,review:{id:editing.id,updatedAt:editing.updatedAt}} : undefined}
      onClose={mine.dismiss} onSubmit={(review)=>mine.save(editing,{rating:review.rating,title:review.title,body:review.body,nameStyle:review.nameStyle,
        ...(review.photoIds ? {photoIds:review.photoIds,viewerKey:review.viewerKey} : {})})} />}
    <ConfirmationDialog open={Boolean(mine.withdrawing)} setOpen={(open)=>{if(!open)mine.dismiss();}}
      title="Withdraw this review?" description="It comes off the product page and out of rating totals. To write again, return to the product page."
      confirmLabel="Withdraw" pendingLabel="Withdrawing…" pending={mine.pending} onConfirm={()=>mine.withdrawing&&mine.save(mine.withdrawing)} />
  </div>;
}
