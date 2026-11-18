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

/**
 * A private read made by this storefront's own pages. Browsers may omit Origin
 * on a same-origin GET, so only a mismatched Origin or a fetch from another
 * site (same-site included) is refused.
 */
export function isSameOriginRead(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  return (origin === null || origin === requestOrigin(request)) && site !== "cross-site" && site !== "same-site";
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

/** Stream a bounded JSON body; a missing/misreported Content-Length cannot bypass the limit. */
export async function readBoundedJsonObject(request: Request, maxBytes: number): Promise<
  { status: "valid"; value: Record<string, unknown> } | { status: "invalid" | "too-large" }
> {
  if (Number(request.headers.get("content-length")) > maxBytes) return { status: "too-large" };
  const reader = request.body?.getReader();
  if (!reader) return { status: "invalid" };
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel().catch(() => {}); return { status: "too-large" }; }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const value: unknown = JSON.parse(text + decoder.decode());
    return value && typeof value === "object" && !Array.isArray(value) ? { status: "valid", value: value as Record<string, unknown> } : { status: "invalid" };
  } catch { return { status: "invalid" }; }
  finally { reader.releaseLock(); }
}

/** Reads one cookie from the headers without consuming the request body. */
export function readCookie(request: Request, name: string) {
  return new NextRequest(request.url, { headers: request.headers }).cookies.get(name)?.value;
}
