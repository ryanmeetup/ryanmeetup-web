import { NextResponse } from "next/server";
import { isReviewPreviewEnabled, parseReviewPreviewChoice, reviewPreviewCookie } from "@/lib/review-provider";

const noStore = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

/** A browser preference for development/preview, never a production setting. */
export async function POST(request: Request) {
  if (!isReviewPreviewEnabled()) return fail("Review testing is not enabled here.", 404);
  // Next may use its internal hostname in request.url. Match the browser's
  // Host and the protocol supplied by Next's proxy headers instead.
  const requestUrl = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? requestUrl.protocol.slice(0, -1);
  const host = request.headers.get("host") ?? requestUrl.host;
  if (!["http", "https"].includes(protocol) || request.headers.get("origin") !== `${protocol}://${host}`) {
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
    secure: protocol === "https",
    path: "/",
    maxAge: choice === "default" ? 0 : 60 * 60 * 24,
  });
  return response;
}
