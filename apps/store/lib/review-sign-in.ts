/**
 * Starts buyer sign-in and returns them to `returnTo` afterwards. The route
 * lives under `/api/`, which robots.txt disallows, so links to it carry
 * `rel="nofollow"` too.
 */
export function reviewSignInUrl(returnTo: string) {
  return `/api/reviews/auth/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export const reviewSignInRel = "nofollow";

/** What happens when a shopper signs in, said before they leave for Shopify. */
export const signInExplanation = {
  title: "Sign in with Shopify",
  body: "We'll send you to Shopify to sign in with your email. Already signed in to Shopify on this device? You'll come straight back as that account.",
  newHere: "New here? Any email works, and Shopify sets up your account with a one-time code.",
} as const;
