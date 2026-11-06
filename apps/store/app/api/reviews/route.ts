import { NextResponse } from "next/server";
import { validateEmail } from "@ryanmeetup/utils";
import { getJudgeMeShopDomain } from "@/lib/judgeme";

const noStore = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length <= max ? value.trim() : "";
}

/**
 * Forwards an unverified web review to Judge.me. Judge.me's create endpoint
 * takes no API token, so this only needs the shop domain; publication follows
 * the moderation settings in Judge.me. Photos are not accepted until they have
 * somewhere to be hosted, since Judge.me only takes picture URLs.
 */
export async function POST(request: Request) {
  const shopDomain = getJudgeMeShopDomain();
  if (!shopDomain) return fail("Review submissions will open when Judge.me is connected.", 503);

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail("Photo reviews aren't available yet. Remove your photos and try again.", 415);
  }

  let submission: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail("Your review could not be read. Please try again.", 400);
    }
    submission = parsed as Record<string, unknown>;
  } catch {
    return fail("Your review could not be read. Please try again.", 400);
  }

  const name = text(submission.name, 100);
  const email = text(submission.email, 254);
  const body = text(submission.body, 5000);
  const productId = text(submission.productId, 200).split("/").at(-1) ?? "";
  const rating = submission.rating;
  if (!name || !body || !/^\d+$/.test(productId) || !Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    return fail("Please complete every required field.", 400);
  }
  if (!validateEmail(email)) return fail("Enter a valid email address.", 400);

  try {
    const response = await fetch("https://judge.me/api/v1/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_domain: shopDomain, platform: "shopify", id: Number(productId), name, email, rating, body }),
      cache: "no-store",
    });
    if (!response.ok) return fail("Judge.me could not accept that review. Please try again.", 502);
  } catch {
    return fail("Judge.me could not be reached. Please try again.", 502);
  }
  return NextResponse.json({ success: true }, { headers: noStore });
}
