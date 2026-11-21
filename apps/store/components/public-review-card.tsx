import Link from "next/link";
import { Card, RatingStars, Text } from "@ryanmeetup/ui";
import { ReviewAuthor, ReviewContent, ReviewVerificationBadge } from "@ryanmeetup/reviews/ui";
import { FiArrowUpRight, FiCalendar } from "react-icons/fi";
import type { Review } from "@/lib/types";
import { reviewAnchorId } from "@/lib/review-links";
import { ReviewPhotoGallery } from "./review-photo-gallery";
import { ReviewReply } from "./review-reply";

/** The same public review presentation on product pages and the home showcase. */
export function PublicReviewCard({ review, product }: { review: Review; product?: { title: string; href: string | null } }) {
  // Header, content, then one bordered footer. Lists lay cards out as masonry,
  // so each card keeps its natural height.
  return <Card size="lg" variant="outline" className="flex flex-col">
    <article id={reviewAnchorId(review.id)} tabIndex={-1} aria-label={`Review by ${review.reviewerName}`}
      className="flex min-w-0 flex-1 scroll-mt-24 flex-col rounded-lg target:outline-2 target:outline-offset-8 target:outline-black/40 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-black/40 dark:target:outline-white/50 dark:focus-visible:outline-white/50">
      {/* Where the review came from leads the card, so it reads before the rating it vouches for. */}
      {review.verification && <div className="mb-3"><ReviewVerificationBadge kind={review.verification} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <RatingStars rating={review.rating} />
        <time className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-black/70 dark:text-white/70" dateTime={review.createdAt}><FiCalendar className="size-3.5 shrink-0" aria-hidden />{new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</time>
      </div>
      <ReviewContent title={review.title} body={review.body} variant="ryan" className="mt-3 space-y-2"
        titleClassName="text-lg" bodyClassName={`max-w-prose ${product ? "line-clamp-5" : ""}`} />
      {!!review.photoUrls?.length && <ReviewPhotoGallery urls={review.photoUrls} reviewerName={review.reviewerName} />}
      <footer className="mt-auto pt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-black/10 pt-4 dark:border-white/10">
          <ReviewAuthor name={review.reviewerName} label="Posted as" />
          {product && (product.href
            ? <Link href={product.href} className="inline-flex max-w-full items-start gap-1 text-sm underline decoration-black/30 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4 dark:decoration-white/30">
              <span className="min-w-0 wrap-anywhere"><span className="sr-only">Review of </span>{product.title}</span><FiArrowUpRight aria-hidden className="mt-0.5 shrink-0" />
            </Link>
            : <Text className="text-sm wrap-anywhere"><span className="sr-only">Review of </span>{product.title}</Text>)}
        </div>
      </footer>
      {!product && review.reply && <ReviewReply reply={review.reply} />}
    </article>
  </Card>;
}
