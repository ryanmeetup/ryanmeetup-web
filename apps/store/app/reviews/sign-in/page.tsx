import { Button, Heading, Text } from "@ryanmeetup/ui";
import type { CustomerSignInProblem } from "@/lib/customer-account/http";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Sign-in problem",
  description: "Your review sign-in didn't go through.",
  canonical: "/reviews/sign-in",
  image: DEFAULT_IMAGE,
  robots: { index: false, follow: false },
});

const copy: Record<CustomerSignInProblem, { title: string; body: string }> = {
  expired: {
    title: "That sign-in expired",
    body: "Sign-in links only last a few minutes, and each one works once. Head back to the product and choose Sign in again.",
  },
  blocked: {
    title: "Start sign-in from the store",
    body: "For your account's safety, sign-in has to begin on this storefront. Go back to the product's reviews and try from there.",
  },
  unavailable: {
    title: "Sign-in is taking a short break",
    body: "We couldn't reach the sign-in service just now. Please try again in a few minutes.",
  },
};

type Props = { searchParams: Promise<{ problem?: string }> };

/** Where a failed review sign-in lands, instead of a raw error response. */
export default async function SignInProblemPage({ searchParams }: Props) {
  const { problem } = await searchParams;
  const { title, body } = copy[problem === "blocked" || problem === "unavailable" ? problem : "expired"];
  return (
    <main className="store-container py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-4">
        <Heading size="h1" className="text-4xl sm:text-5xl">{title}</Heading>
        <Text>{body}</Text>
        <Button.Link href="/" size="md" className="w-full sm:w-auto">Back to the store</Button.Link>
      </div>
    </main>
  );
}
