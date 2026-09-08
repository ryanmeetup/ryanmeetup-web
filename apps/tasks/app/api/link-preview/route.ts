import { NextResponse } from "next/server";
import { authorize } from "@/lib/server/auth";
import { loadLinkPreviewImage } from "@/lib/server/link-preview";
import { apiError } from "@/lib/server/api-response";

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_CACHE_ITEMS = 200;
const previews = new Map<
  string,
  { imageUrl: string | null; expiresAt: number }
>();

export async function GET(request: Request) {
  const authorization = await authorize({ onboarded: true });
  if ("response" in authorization) return authorization.response;

  const url = new URL(request.url).searchParams.get("url")?.trim();
  if (!url || url.length > 2_048)
    return apiError(400, "INVALID_REQUEST", "Enter a valid link to preview.");

  const cached = previews.get(url);
  if (cached && cached.expiresAt > Date.now())
    return NextResponse.json(
      { imageUrl: cached.imageUrl },
      { headers: { "Cache-Control": "private, max-age=86400" } },
    );

  let imageUrl: string | null = null;
  try {
    imageUrl = await loadLinkPreviewImage(url);
  } catch {
    // A preview is optional presentation. DNS failures, unsupported pages,
    // timeouts, and unsafe destinations all return the normal icon fallback.
  }

  if (previews.size >= MAX_CACHE_ITEMS)
    previews.delete(previews.keys().next().value!);
  previews.set(url, { imageUrl, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(
    { imageUrl },
    { headers: { "Cache-Control": "private, max-age=86400" } },
  );
}
