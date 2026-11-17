import { NextResponse } from "next/server";
import { isReviewPreviewEnabled, parseReviewPreviewChoice, reviewPreviewCookie } from "@/lib/review-provider";

const noStore = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

/** A browser preference for development/preview, never a production setting. */
export async function POST(request: Request) {
  if (!isReviewPreviewEnabled()) return fail("Review testing is not enabled here.", 404);
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return fail("Change review mode from this storefront.", 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return fail("Choose a review mode.", 415);
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Choose a review mode.", 400);
  }
  const choice = parseReviewPreviewChoice(payload && typeof payload === "object" && "provider" in payload ? payload.provider : undefined);
  if (!choice) return fail("Choose a review mode.", 400);

  const response = NextResponse.json({ success: true }, { headers: noStore });
  response.cookies.set(reviewPreviewCookie, choice === "default" ? "" : choice, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: choice === "default" ? 0 : 60 * 60 * 24,
  });
  return response;
}
