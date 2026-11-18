import { decodeJwt } from "jose";
import type { CustomerAccountSession } from "./storage";

/**
 * The email on the buyer's Shopify ID token, to show who is signed in. The
 * token was verified at sign-in and is kept server-side, so this only reads it.
 */
export function customerAccountEmail(session: Pick<CustomerAccountSession, "tokens">): string | null {
  try {
    const email = decodeJwt(session.tokens.idToken).email;
    return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(email) ? email : null;
  } catch {
    return null;
  }
}
