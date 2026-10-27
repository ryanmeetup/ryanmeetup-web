import { NextResponse } from "next/server";
import {
  googleAccountEmail,
  parseGoogleOAuthCookie,
  requestCookie,
} from "@/lib/server/google-oauth";
import { rydContext } from "@/lib/server/ryd";
import {
  exchangeRydGoogleCode,
  hasRydGoogleScopes,
  RYD_GOOGLE_COOKIE,
  rydGoogleIntegrationValues,
} from "@/lib/server/ryd-google";

function rydRedirect(request: Request, status: string) {
  const response = NextResponse.redirect(
    new URL(`/ryd?google=${status}`, request.url),
  );
  response.cookies.set(RYD_GOOGLE_COOKIE, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/integrations/ryd-google",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = parseGoogleOAuthCookie(
    requestCookie(request, RYD_GOOGLE_COOKIE),
  );
  if (!code || !state || !cookie || state !== cookie.state)
    return rydRedirect(request, "invalid");

  const context = await rydContext({ settings: true });
  if ("response" in context) return rydRedirect(request, "auth");

  try {
    const tokens = await exchangeRydGoogleCode(request, code, cookie.verifier);
    if (!tokens.refresh_token) return rydRedirect(request, "refresh-token");
    if (!hasRydGoogleScopes(tokens.scope))
      return rydRedirect(request, "scopes");
    const email = await googleAccountEmail(tokens.access_token);
    const result = await context.admin
      .from("ryd_google_integrations")
      .upsert(
        rydGoogleIntegrationValues(
          tokens.refresh_token,
          email,
          context.user.id,
        ),
      );
    if (result.error) throw result.error;
  } catch (error) {
    console.error("RY-D Google connection failed", error);
    return rydRedirect(request, "failed");
  }
  return rydRedirect(request, "connected");
}
