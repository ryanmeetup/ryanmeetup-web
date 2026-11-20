import Link from "next/link";
import { Card, Heading, RatingStars, Text } from "@ryanmeetup/ui";
import { FiArrowUpRight, FiCalendar, FiUser } from "react-icons/fi";
import type { Review } from "@/lib/types";
import { reviewAnchorId } from "@/lib/review-links";
import { ReviewPhotoGallery } from "./review-photo-gallery";
import { ReviewReply } from "./review-reply";
import { VerifiedBadge } from "./verified-badge";

/** The same public review presentation on product pages and the home showcase. */
export function PublicReviewCard({ review, product }: { review: Review; product?: { title: string; href: string | null } }) {
  return <Card size="lg" variant="outline" className={product ? "flex h-full flex-col" : undefined}>
    <article id={reviewAnchorId(review.id)} tabIndex={-1} aria-label={`Review by ${review.reviewerName}`}
      className="min-w-0 scroll-mt-24 rounded-lg target:outline-2 target:outline-offset-8 target:outline-black/40 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-black/40 dark:target:outline-white/50 dark:focus-visible:outline-white/50">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <RatingStars rating={review.rating} />
        <time className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-black/70 dark:text-white/70" dateTime={review.createdAt}><FiCalendar className="size-3.5 shrink-0" aria-hidden />{new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</time>
      </div>
      {review.title && <Heading size="h3" className="mt-3 break-words text-xl">{review.title}</Heading>}
      <Text className={`mt-2 max-w-prose whitespace-pre-line break-words ${product ? "line-clamp-5" : ""}`}>{review.body}</Text>
      {!!review.photoUrls?.length && <ReviewPhotoGallery urls={review.photoUrls} reviewerName={review.reviewerName} />}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Text className="flex min-w-0 items-center gap-1.5 text-sm font-semibold"><FiUser className="size-3.5 shrink-0" aria-hidden /><span className="min-w-0 break-words">{review.reviewerName}</span></Text>
        {review.verification && <VerifiedBadge kind={review.verification} />}
      </div>
      {!product && review.reply && <ReviewReply reply={review.reply} />}
    </article>
    {product && <div className="mt-auto pt-5">
      {product.href ? <Link href={product.href} className="inline-flex max-w-full items-start gap-1 text-sm underline decoration-black/30 underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4 dark:decoration-white/30">
        <span className="min-w-0 wrap-anywhere">Review of {product.title}</span><FiArrowUpRight aria-hidden className="mt-0.5 shrink-0" />
      </Link> : <Text className="text-sm wrap-anywhere">Review of {product.title}</Text>}
    </div>}
  </Card>;
}
