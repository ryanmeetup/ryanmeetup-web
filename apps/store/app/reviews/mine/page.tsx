import { Breadcrumbs, Heading } from "@ryanmeetup/ui";
import { FiMessageSquare, FiStar } from "react-icons/fi";
import { MyReviews } from "@/components/my-reviews";
import { ReviewSignInPrompt } from "@/components/review-sign-in-prompt";
import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";
import { StoreHomeIcon } from "@/lib/navigation";
import { currentRequest } from "@/lib/request-from-headers";
import { getReviewBackend } from "@/lib/review-backend";
import { loadMyReviewPage } from "@/lib/my-review-actions";
import { findBuyerName, findRecentReviewablePurchases } from "@/lib/review-purchases";
import { getReviewSuggestions } from "@/lib/review-suggestions";
import { getReviewSuggestionStorage } from "@/lib/review-suggestion-storage";
import { getCustomerAccountUrl, getProductCardsByIds } from "@/lib/shopify";
import { reviewPhotosEnabled } from "@/lib/review-photo-policy";

export const metadata = buildPageMetadata({
  title: "My Reviews",
  description: "Edit or withdraw the reviews you've written.",
  canonical: "/reviews/mine",
  image: DEFAULT_IMAGE,
  robots: { index: false, follow: false },
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="store-container space-y-8 py-10 sm:py-14">
      <div>
        <Breadcrumbs variant="compact" crumbs={[
          { href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> },
          { href: "/reviews", title: "Reviews", icon: <FiStar aria-hidden className="shrink-0" /> },
          { href: "/reviews/mine", title: "My Reviews", current: true, icon: <FiMessageSquare aria-hidden className="shrink-0" /> },
        ]} />
        <Heading size="h1" className="mt-3 text-4xl sm:text-5xl">My Reviews</Heading>
      </div>
      {children}
    </main>
  );
}

const signInPrompt = <ReviewSignInPrompt title="Sign in to see your reviews" returnTo="/reviews/mine" />;

export default async function Page({ searchParams }: { searchParams: Promise<{ preview?: string | string[] }> }) {
  const request = await currentRequest("/reviews/mine");
  const backend = getReviewBackend();
  const suggestionStorage = getReviewSuggestionStorage();
  const session = getCustomerAccountSession(request);
  // Local dev only: sign-in can't complete on localhost, so a signed-out
  // visitor (or ?preview=) sees sample data with a scenario switcher. The
  // NODE_ENV check is inlined at build time, so production drops this branch.
  // Test servers run against the synthetic Supabase fixture and keep the real flow.
  if (process.env.NODE_ENV === "development" && process.env.SUPABASE_SECRET_KEY !== "synthetic-supabase-secret") {
    const { preview } = await searchParams;
    const signedIn = (await session.catch(() => null))?.status === "authenticated";
    if (preview !== undefined || !signedIn) {
      const { MyReviewsDevPreview } = await import("@/components/my-reviews-dev-preview");
      const { isSampleScenario } = await import("@/lib/my-reviews-samples");
      return <Shell><MyReviewsDevPreview scenario={isSampleScenario(preview) ? preview : "everything"} signedOut={signInPrompt} /></Shell>;
    }
  }
  const [result, suggestions] = await Promise.all([
    loadMyReviewPage(null, { loadSession: () => session, findBuyerName, backend, photosEnabled: reviewPhotosEnabled(), productCards: getProductCardsByIds }),
    // Suggestions are a nicety: any failure leaves them out rather than failing the page.
    session.then(async (current) => current.status === "authenticated" && backend && suggestionStorage ? getReviewSuggestions({
      session: current.session, findRecent: findRecentReviewablePurchases, productCards: getProductCardsByIds,
      accountUrl: await getCustomerAccountUrl().catch(() => null),
      reviewedLines: (subject, lineIds) => backend({ operation: "reviews.reviewedLines", subject, lineIds }),
      dismissedLines: suggestionStorage.dismissedLines,
    }) : null).catch(() => null),
  ]);
  if (result.status === "sign_in_required") return <Shell>{signInPrompt}</Shell>;
  return <Shell><MyReviews key={result.status === "ready" ? `${result.view.viewerKey}:${Boolean(result.view.photosEnabled)}` : "unavailable"} initial={result.status === "ready" ? result.view : null} suggestions={result.status === "ready" ? suggestions : null} editRoutes /></Shell>;
}
