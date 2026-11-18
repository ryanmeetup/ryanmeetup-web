import { NextResponse } from "next/server";
import { privateHeaders, readCookie, requestOrigin } from "../request-guard";
import { isLoopbackHost } from "../review-provider";
import { customerAuthorizationCookie } from "./authorization";
import { getCustomerAccountStorageService, getCustomerSignInService } from "./runtime";
import { beginCustomerSignIn, completeCustomerSignIn, customerSessionCookie, customerSessionLifetime } from "./sign-in";

const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

/** Problems a buyer can land on after a failed sign-in navigation. */
export type CustomerSignInProblem = "expired" | "blocked" | "unavailable";
export const customerSignInProblemPath = "/reviews/sign-in";

/**
 * Sign-in start and callback are browser navigations: send people to a page
 * that explains what happened instead of raw JSON. Programmatic callers keep
 * the status code and JSON error.
 */
function failure(request: Request, status: number, error: string) {
  if (request.headers.get("accept")?.includes("text/html")) {
    const problem: CustomerSignInProblem = status === 403 ? "blocked" : status === 503 ? "unavailable" : "expired";
    return new NextResponse(null, { status: 303, headers: { ...privateHeaders, Location: `${customerSignInProblemPath}?problem=${problem}` } });
  }
  return NextResponse.json({ error }, { status, headers: privateHeaders });
}

export async function startCustomerSignIn(request: Request) {
  const service = await getCustomerSignInService();
  if (!service) return failure(request, 503, "Customer sign-in is temporarily unavailable.");
  const origin = new URL(service.config.redirectUri).origin;
  // Shopify only returns to the registered HTTPS address, which localhost can't
  // be. In development, hop there and start from it; the session lives there.
  if (process.env.NODE_ENV !== "production" && isLoopbackHost(request.headers.get("host")) && requestOrigin(request) !== origin) {
    const url = new URL(request.url);
    return NextResponse.redirect(new URL(`${url.pathname}${url.search}`, origin), { status: 303, headers: privateHeaders });
  }
  if (requestOrigin(request) !== origin || (request.headers.has("origin") && request.headers.get("origin") !== origin) ||
    request.headers.get("sec-fetch-site") === "cross-site") return failure(request, 403, "Start customer sign-in from this storefront.");
  const url = new URL(request.url);
  if (url.searchParams.getAll("returnTo").length > 1) return failure(request, 400, "Choose a single return destination.");
  try {
    const prepared = await beginCustomerSignIn(service, url.searchParams.get("returnTo"));
    const response = NextResponse.redirect(prepared.authorizationUrl, { status: 303, headers: privateHeaders });
    response.cookies.set(prepared.cookie.name, prepared.cookie.value, prepared.cookie);
    return response;
  } catch { return failure(request, 503, "Customer sign-in is temporarily unavailable. Please try again."); }
}

export async function callbackCustomerSignIn(request: Request) {
  let response: NextResponse;
  try {
    const service = await getCustomerSignInService();
    if (!service) response = failure(request, 503, "Customer sign-in is temporarily unavailable.");
    else {
      const origin = new URL(service.config.redirectUri).origin;
      if (requestOrigin(request) !== origin) response = failure(request, 400, "This sign-in callback is not valid.");
      else {
        // Next's request URL can contain an internal hostname. The public origin
        // was checked above; use the configured callback for state validation.
        const incoming = new URL(request.url);
        const callbackUrl = new URL(`${incoming.pathname}${incoming.search}`, origin).href;
        const binding = readCookie(request, customerAuthorizationCookie);
        const completed = await completeCustomerSignIn(service, callbackUrl, binding);
        if (completed.status === "invalid") response = failure(request, 400, "This sign-in has expired or is not valid. Please start again.");
        else {
          response = NextResponse.redirect(new URL(completed.returnPath, origin), { status: 303, headers: privateHeaders });
          if (completed.status === "signed_in") response.cookies.set(customerSessionCookie, completed.id, { ...cookieOptions, maxAge: customerSessionLifetime });
        }
      }
    }
  } catch { response = failure(request, 503, "Customer sign-in could not be completed. Please start again."); }
  response.cookies.set(customerAuthorizationCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

/** Revokes the review session even after the browser switches back to Judge.me. */
export async function logoutCustomerSignIn(request: Request) {
  const service = getCustomerAccountStorageService({ logout: true });
  if (!service) return failure(request, 503, "Sign-out is temporarily unavailable. Please try again.");
  const origin = new URL(service.config.redirectUri).origin;
  if (requestOrigin(request) !== origin || request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site") return failure(request, 403, "Sign out from this storefront.");
  try {
    const id = readCookie(request, customerSessionCookie);
    await service.storage.revokeSession(id);
    const response = NextResponse.json({ signedOut: true }, { headers: privateHeaders });
    response.cookies.set(customerSessionCookie, "", { ...cookieOptions, maxAge: 0 });
    response.cookies.set(customerAuthorizationCookie, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch { return failure(request, 503, "Sign-out could not be completed. Please try again."); }
}
