import { notFound } from "next/navigation";
import { Button, Heading, Text } from "@ryanmeetup/ui";
import { MyReviews } from "@/components/my-reviews";
import { getCustomerAccountSession } from "@/lib/customer-account/runtime";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";
import { currentRequest } from "@/lib/request-from-headers";
import { getReviewBackend } from "@/lib/review-backend";
import { loadMyReviewPage } from "@/lib/my-review-actions";
import { getActiveReviewProvider } from "@/lib/review-preview";
import { reviewSignInRel, reviewSignInUrl } from "@/lib/review-sign-in";
import { findBuyerName } from "@/lib/review-purchases";

export const metadata = buildPageMetadata({
  title: "My reviews",
  description: "Edit or withdraw the reviews you've written.",
  canonical: "/reviews/mine",
  image: DEFAULT_IMAGE,
  robots: { index: false, follow: false },
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="store-container py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <Heading size="h1" className="text-4xl sm:text-5xl">My reviews</Heading>
          <Text>Edit or withdraw what you&apos;ve written. Edits are checked before they go up.</Text>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function Page() {
  // Only custom reviews have buyer accounts; Judge.me reviews are managed there.
  if (await getActiveReviewProvider() !== "custom") notFound();
  const request = await currentRequest("/reviews/mine");
  const result = await loadMyReviewPage(null, {
    loadSession: () => getCustomerAccountSession(request), findBuyerName, backend:getReviewBackend(),
  });
  if (result.status === "sign_in_required") return <Shell>
    <div className="space-y-4 rounded-2xl border border-black/10 p-6 dark:border-white/10">
      <Text>Sign in with the email you ordered with to see your reviews.</Text>
      <Button.Link href={reviewSignInUrl("/reviews/mine")} rel={reviewSignInRel} prefetch={false} size="md" className="w-full sm:w-auto">Sign in</Button.Link>
    </div>
  </Shell>;
  return <Shell><MyReviews initial={result.status === "ready" ? result.view : null} /></Shell>;
}
