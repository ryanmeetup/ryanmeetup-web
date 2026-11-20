import { Button, Heading, Text } from "@ryanmeetup/ui";
import { FiLogIn } from "react-icons/fi";
import { MyReviews } from "@/components/my-reviews";
import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";
import { currentRequest } from "@/lib/request-from-headers";
import { getReviewBackend } from "@/lib/review-backend";
import { loadMyReviewPage } from "@/lib/my-review-actions";
import { reviewSignInRel, reviewSignInUrl } from "@/lib/review-sign-in";
import { findBuyerName, findRecentReviewablePurchases } from "@/lib/review-purchases";
import { getReviewSuggestions } from "@/lib/review-suggestions";
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
      <Heading size="h1" className="text-4xl sm:text-5xl">My Reviews</Heading>
      {children}
    </main>
  );
}

function SignInPrompt() {
  return (
      <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center dark:border-white/20 sm:p-10">
        <FiLogIn aria-hidden className="mx-auto size-6 text-black/60 dark:text-white/60" />
        <Heading size="h2" className="mt-3 text-xl">Sign in to see your reviews</Heading>
        <Text className="mx-auto mt-2 max-w-md">Use the email you ordered with, and we&apos;ll bring you right back here.</Text>
        <Button.Link href={reviewSignInUrl("/reviews/mine")} rel={reviewSignInRel} prefetch={false} size="md" className="mt-6 w-full sm:w-auto">Sign in</Button.Link>
      </div>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ preview?: string | string[] }> }) {
  const request = await currentRequest("/reviews/mine");
  const backend = getReviewBackend();
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
      return <Shell><MyReviewsDevPreview scenario={isSampleScenario(preview) ? preview : "everything"} signedOut={<SignInPrompt />} /></Shell>;
    }
  }
  const [result, suggestions] = await Promise.all([
    loadMyReviewPage(null, { loadSession: () => session, findBuyerName, backend, photosEnabled: reviewPhotosEnabled(), productCards: getProductCardsByIds }),
    // Suggestions are a nicety: any failure leaves them out rather than failing the page.
    session.then(async (current) => current.status === "authenticated" && backend ? getReviewSuggestions({
      session: current.session, findRecent: findRecentReviewablePurchases, productCards: getProductCardsByIds,
      accountUrl: await getCustomerAccountUrl().catch(() => null),
      reviewedLines: (subject, lineIds) => backend({ operation: "reviews.reviewedLines", subject, lineIds }),
    }) : null).catch(() => null),
  ]);
  if (result.status === "sign_in_required") return <Shell><SignInPrompt /></Shell>;
  return <Shell><MyReviews key={result.status === "ready" ? `${result.view.viewerKey}:${Boolean(result.view.photosEnabled)}` : "unavailable"} initial={result.status === "ready" ? result.view : null} suggestions={result.status === "ready" ? suggestions : null} /></Shell>;
}
