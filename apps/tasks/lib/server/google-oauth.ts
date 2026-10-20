import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { isAllowedTasksRequestOrigin, tasksAppUrl } from "@/lib/app-url";

/**
 * The OAuth plumbing every Google connection in this app shares: one Google
 * Cloud client, one token key, PKCE, and refresh tokens sealed with AES-GCM.
 * Each integration supplies only its scopes and its callback path, so the
 * Calendar and the RY-D form sheet cannot drift into two ways of storing a
 * Google credential.
 *
 * The variables keep their `GOOGLE_CALENDAR_` names because the Calendar
 * shipped first and both instances already set them.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export function googleOAuthConfiguration() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const tokenKey = process.env.GOOGLE_CALENDAR_TOKEN_KEY;
  if (!clientId || !clientSecret || !tokenKey) return null;
  return { clientId, clientSecret, tokenKey };
}

export function isGoogleOAuthConfigured() {
  const config = googleOAuthConfiguration();
  if (!config) return false;
  return Buffer.from(config.tokenKey, "base64").length === 32;
}

function requireConfiguration() {
  const config = googleOAuthConfiguration();
  if (!config) throw new Error("Google sign-in is not configured.");
  return config;
}

export function googleRedirectUri(
  callbackPath: string,
  request?: Request | string,
) {
  if (request) {
    const requestUrl = new URL(
      typeof request === "string" ? request : request.url,
    );
    if (isAllowedTasksRequestOrigin(requestUrl.origin)) {
      return new URL(callbackPath, requestUrl.origin).toString();
    }
  }
  return tasksAppUrl(callbackPath, request);
}

function encryptionKey(value: string) {
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32)
    throw new Error(
      "GOOGLE_CALENDAR_TOKEN_KEY must be a base64-encoded 32-byte key.",
    );
  return decoded;
}

export function encryptGoogleRefreshToken(token: string) {
  const config = requireConfiguration();
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    encryptionKey(config.tokenKey),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return ["v1", iv, cipher.getAuthTag(), encrypted]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url"),
    )
    .join(".");
}

export function decryptGoogleRefreshToken(value: string) {
  const config = requireConfiguration();
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue)
    throw new Error("The saved Google connection is invalid.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(config.tokenKey),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createGoogleOAuthRequest(
  request: Request,
  { scopes, callbackPath }: { scopes: readonly string[]; callbackPath: string },
) {
  const config = requireConfiguration();
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleRedirectUri(callbackPath, request),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return {
    url,
    cookieValue: Buffer.from(JSON.stringify({ state, verifier })).toString(
      "base64url",
    ),
  };
}

export function parseGoogleOAuthCookie(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as { state?: unknown; verifier?: unknown };
    return typeof parsed.state === "string" &&
      typeof parsed.verifier === "string"
      ? { state: parsed.state, verifier: parsed.verifier }
      : null;
  } catch {
    return null;
  }
}

/** The named cookie's value from a request, for the OAuth callback. */
export function requestCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * A JSON request to Google. `service` names the integration in the log and in
 * the thrown message, so a Sheets outage isn't reported as the Calendar's.
 */
export async function googleJson<T>(
  url: string,
  init: RequestInit,
  service = "Google",
) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    console.error(`${service} request failed`, {
      status: response.status,
      body: body.slice(0, 500),
    });
    throw new Error(`${service} could not be reached.`);
  }
  return response.json() as Promise<T>;
}

export async function exchangeGoogleAuthorizationCode(
  request: Request,
  code: string,
  verifier: string,
  callbackPath: string,
) {
  const config = requireConfiguration();
  return googleJson<{
    access_token: string;
    refresh_token?: string;
    scope?: string;
  }>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(callbackPath, request),
    }),
  });
}

export async function googleAccountEmail(accessToken: string) {
  const profile = await googleJson<{ email?: string }>(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profile.email)
    throw new Error("Google did not return an account email.");
  return profile.email;
}

export async function googleAccessToken(
  encryptedRefreshToken: string,
  service = "Google",
) {
  const config = requireConfiguration();
  const result = await googleJson<{ access_token: string }>(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: decryptGoogleRefreshToken(encryptedRefreshToken),
        grant_type: "refresh_token",
      }),
    },
    service,
  );
  return result.access_token;
}

/** Best effort: a failed revoke still lets the connection row be deleted. */
export async function revokeGoogleRefreshToken(
  encryptedRefreshToken: string,
  service = "Google",
) {
  if (!googleOAuthConfiguration()) return;
  try {
    await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: decryptGoogleRefreshToken(encryptedRefreshToken),
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`${service} token revocation failed`, error);
  }
}
