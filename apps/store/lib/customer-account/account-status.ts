import { isSameOriginRead, privateJson } from "../request-guard";
import { customerAccountEmail } from "./identity";
import type { CustomerSessionResult } from "./session";

/**
 * What the header's account menu shows. `unavailable` covers both sign-in
 * not being set up here and a storage failure: the menu then offers only the
 * Shopify account link, never a sign-in that can't complete.
 */
export type CustomerAccountStatus =
  /** `reviews` is true while custom reviews are the store's reviews, so "My reviews" has something to manage. */
  | { status: "signed-in"; email: string | null; reviews: boolean }
  | { status: "signed-out" }
  | { status: "unavailable" };

/** The signed-in buyer's own status. Private and uncached; the email never leaves this browser's response. */
export async function handleAccountStatus(request: Request, { loadSession, customReviews }: { loadSession: () => Promise<CustomerSessionResult>; customReviews: boolean }) {
  if (!isSameOriginRead(request)) return privateJson(403, { error: "Read your account from this storefront." });
  const session = await loadSession().catch((): CustomerSessionResult => ({ status: "unavailable" }));
  const body: CustomerAccountStatus = session.status === "authenticated" ? { status: "signed-in", email: customerAccountEmail(session.session), reviews: customReviews }
    : session.status === "sign_in_required" ? { status: "signed-out" } : { status: "unavailable" };
  return privateJson(200, body);
}
