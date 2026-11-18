import { NextResponse } from "next/server";
import { isReviewPreviewEnabled, parseReviewPreviewChoice, requestHost, reviewPreviewCookie } from "@/lib/review-provider";
import { hasJsonBody, isSameOriginRequest, privateHeaders, readJsonObject, requestOrigin } from "@/lib/request-guard";

const fail = (status: number, body: { error: string }) => NextResponse.json(body, { status, headers: privateHeaders });

/** A browser preference for localhost testing, never a deployed setting. */
export async function POST(request: Request) {
  if (!isReviewPreviewEnabled(requestHost(request))) return fail(404, { error: "Review testing is not enabled here." });
  if (!isSameOriginRequest(request)) return fail(403, { error: "Change review mode from this storefront." });
  if (!hasJsonBody(request)) return fail(415, { error: "Choose a review mode." });
  const choice = parseReviewPreviewChoice((await readJsonObject(request))?.provider);
  if (!choice) return fail(400, { error: "Choose a review mode." });

  const response = NextResponse.json({ success: true }, { headers: privateHeaders });
  response.cookies.set(reviewPreviewCookie, choice === "default" ? "" : choice, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestOrigin(request)?.startsWith("https:") ?? false,
    path: "/",
    maxAge: choice === "default" ? 0 : 60 * 60 * 24,
  });
  return response;
}
