import { NextRequest } from "next/server";

/** Responses carrying buyer state or credentials are never cached or referred onward. */
export const privateHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } as const;

export function privateJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: privateHeaders });
}

/**
 * The browser-facing origin of a request. Next can put its internal hostname in
 * `request.url`, so prefer the Host header and the proxy's protocol.
 */
export function requestOrigin(request: Request): string | null {
  const url = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
  const host = request.headers.get("host") ?? url.host;
  return protocol === "http" || protocol === "https" ? `${protocol}://${host}` : null;
}

/** A state-changing request sent by this storefront's own pages. */
export function isSameOriginRequest(request: Request) {
  const origin = requestOrigin(request);
  return origin !== null && request.headers.get("origin") === origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

export function hasJsonBody(request: Request) {
  return request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";
}

/** The request's JSON object body, or null when it is missing, malformed, or not an object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Reads one cookie from the headers without consuming the request body. */
export function readCookie(request: Request, name: string) {
  return new NextRequest(request.url, { headers: request.headers }).cookies.get(name)?.value;
}
