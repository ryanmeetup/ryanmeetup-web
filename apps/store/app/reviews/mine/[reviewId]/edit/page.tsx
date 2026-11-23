import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Breadcrumbs, ErrorCallout } from "@ryanmeetup/ui";
import { FiEdit2, FiMessageSquare, FiStar } from "react-icons/fi";
import { EditReviewRoute } from "@/components/my-review-editor";
import { ReviewSignInPrompt } from "@/components/review-sign-in-prompt";
import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";
import { loadMyReview } from "@/lib/my-review-actions";
import { StoreHomeIcon } from "@/lib/navigation";
import { currentRequest } from "@/lib/request-from-headers";
import { getReviewBackend } from "@/lib/review-backend";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";
import { findBuyerName } from "@/lib/review-purchases";
import { getProductCardsByIds } from "@/lib/shopify";

type Props = { params: Promise<{ reviewId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return buildPageMetadata({
    title: "Edit Your Review",
    description: "Change what your review says, how your name appears, or its photos.",
    canonical: `/reviews/mine/${(await params).reviewId}/edit`,
    image: DEFAULT_IMAGE,
    robots: { index: false, follow: false },
  });
}

/**
 * The My reviews editor as a page, for phones; My reviews keeps the dialog from
 * `sm` up. A review has no readable identifier, so the route names it by ID,
 * and only the signed-in buyer who wrote it can open it.
 */
export default async function EditReviewPage({ params }: Props) {
  const { reviewId } = await params;
  const path = `/reviews/mine/${reviewId}/edit`;
  const request = await currentRequest(path);
  const result = await loadMyReview(reviewId, {
    loadSession: () => getCustomerAccountSession(request), findBuyerName, backend: getReviewBackend(),
    photosEnabled: reviewPhotosEnabled(), productCards: getProductCardsByIds,
  });
  if (result.status === "not_found") notFound();
  // Hidden and withdrawn reviews can't be edited; My reviews says why.
  if (result.status === "ready" && (result.review.status === "hidden" || result.review.status === "withdrawn")) redirect("/reviews/mine");

  return (
    <main className="store-container space-y-8 py-10 sm:py-14">
      <Breadcrumbs variant="compact" crumbs={[
        { href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> },
        { href: "/reviews", title: "Reviews", icon: <FiStar aria-hidden className="shrink-0" /> },
        { href: "/reviews/mine", title: "My Reviews", icon: <FiMessageSquare aria-hidden className="shrink-0" /> },
        { href: path, title: "Edit your review", current: true, icon: <FiEdit2 aria-hidden className="shrink-0" /> },
      ]} />
      {result.status === "ready" ? <EditReviewRoute key={`${result.review.id}-${result.review.updatedAt}`} review={result.review} product={result.product}
          buyerName={result.buyerName} viewerKey={result.viewerKey} photosEnabled={result.photosEnabled} />
        : result.status === "sign_in_required" ? <ReviewSignInPrompt title="Sign in to edit your review" returnTo={path} />
        : <ErrorCallout>Your reviews are temporarily unavailable. Please try again later.</ErrorCallout>}
    </main>
  );
}
