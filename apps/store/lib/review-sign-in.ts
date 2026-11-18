/**
 * Starts buyer sign-in and returns them to `returnTo` afterwards. The route
 * lives under `/api/`, which robots.txt disallows, so links to it carry
 * `rel="nofollow"` too.
 */
export function reviewSignInUrl(returnTo: string) {
  return `/api/reviews/auth/start?returnTo=${encodeURIComponent(returnTo)}`;
}

export const reviewSignInRel = "nofollow";
