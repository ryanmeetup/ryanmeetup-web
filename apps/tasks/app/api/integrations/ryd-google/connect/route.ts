import { NextResponse } from "next/server";
import { rydContext } from "@/lib/server/ryd";
import {
  createRydGoogleOAuthRequest,
  isRydGoogleConfigured,
  RYD_GOOGLE_COOKIE,
} from "@/lib/server/ryd-google";

export async function GET(request: Request) {
  const context = await rydContext();
  if ("response" in context) return context.response;
  if (!isRydGoogleConfigured())
    return NextResponse.redirect(
      new URL("/ryd?google=unavailable", request.url),
    );

  const oauth = createRydGoogleOAuthRequest(request);
  const response = NextResponse.redirect(oauth.url);
  response.cookies.set(RYD_GOOGLE_COOKIE, oauth.cookieValue, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/api/integrations/ryd-google",
    maxAge: 10 * 60,
  });
  return response;
}
