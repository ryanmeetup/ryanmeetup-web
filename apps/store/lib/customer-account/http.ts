import { NextRequest, NextResponse } from "next/server";
import { customerAuthorizationCookie } from "./authorization";
import { getCustomerAccountStorageService, getCustomerSignInService } from "./runtime";
import { beginCustomerSignIn, completeCustomerSignIn, customerSessionCookie, customerSessionLifetime } from "./sign-in";

const privateHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
const failure = (status: number, error: string) => NextResponse.json({ error }, { status, headers: privateHeaders });

function requestMatchesOrigin(request: Request, expected: string) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
  return protocol === "https" && `${protocol}://${host}` === expected;
}

export async function startCustomerSignIn(request: Request) {
  const service = await getCustomerSignInService(request);
  if (!service) return failure(503, "Customer sign-in is temporarily unavailable.");
  const origin = new URL(service.config.redirectUri).origin;
  if (!requestMatchesOrigin(request, origin) || (request.headers.has("origin") && request.headers.get("origin") !== origin) ||
    request.headers.get("sec-fetch-site") === "cross-site") return failure(403, "Start customer sign-in from this storefront.");
  const url = new URL(request.url);
  if (url.searchParams.getAll("returnTo").length > 1) return failure(400, "Choose a single return destination.");
  try {
    const prepared = await beginCustomerSignIn(service, url.searchParams.get("returnTo"));
    const response = NextResponse.redirect(prepared.authorizationUrl, { status: 303, headers: privateHeaders });
    response.cookies.set(prepared.cookie.name, prepared.cookie.value, prepared.cookie);
    return response;
  } catch { return failure(503, "Customer sign-in is temporarily unavailable. Please try again."); }
}

export async function callbackCustomerSignIn(request: Request) {
  let response: NextResponse;
  try {
    const service = await getCustomerSignInService(request);
    if (!service) response = failure(503, "Customer sign-in is temporarily unavailable.");
    else {
      const origin = new URL(service.config.redirectUri).origin;
      if (!requestMatchesOrigin(request, origin)) response = failure(400, "This sign-in callback is not valid.");
      else {
        // Next's request URL can contain an internal hostname. The public origin
        // was checked above; use the configured callback for state validation.
        const incoming = new URL(request.url);
        const callbackUrl = new URL(`${incoming.pathname}${incoming.search}`, origin).href;
        const binding = new NextRequest(request.url, { headers: request.headers }).cookies.get(customerAuthorizationCookie)?.value;
        const completed = await completeCustomerSignIn(service, callbackUrl, binding);
        if (completed.status === "invalid") response = failure(400, "This sign-in has expired or is not valid. Please start again.");
        else {
          response = NextResponse.redirect(new URL(completed.returnPath, origin), { status: 303, headers: privateHeaders });
          if (completed.status === "signed_in") response.cookies.set(customerSessionCookie, completed.id, { ...cookieOptions, maxAge: customerSessionLifetime });
        }
      }
    }
  } catch { response = failure(503, "Customer sign-in could not be completed. Please start again."); }
  response.cookies.set(customerAuthorizationCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

/** Revokes the review session even after the browser switches back to Judge.me. */
export async function logoutCustomerSignIn(request: Request) {
  const service = getCustomerAccountStorageService(request, { logout: true });
  if (!service) return failure(503, "Sign-out is temporarily unavailable. Please try again.");
  const origin = new URL(service.config.redirectUri).origin;
  if (!requestMatchesOrigin(request, origin) || request.headers.get("origin") !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site") return failure(403, "Sign out from this storefront.");
  try {
    const id = new NextRequest(request.url, { headers: request.headers }).cookies.get(customerSessionCookie)?.value;
    await service.storage.revokeSession(id);
    const response = NextResponse.json({ signedOut: true }, { headers: privateHeaders });
    response.cookies.set(customerSessionCookie, "", { ...cookieOptions, maxAge: 0 });
    response.cookies.set(customerAuthorizationCookie, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch { return failure(503, "Sign-out could not be completed. Please try again."); }
}
