import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { customerAccountIssuer, publicHttpsUrl } from "./config";
import type { CustomerAccountConfig } from "./config";
import type { CustomerAccountEndpoints } from "./discovery";

export const customerAuthorizationCookie = "__Host-store-customer-oauth";
export const customerAuthorizationLifetime = 600;

/** Private, short-lived record for the future server-side authorization store. */
export type CustomerAuthorizationAttempt = {
  stateHash: string;
  browserBindingHash: string;
  nonce: string;
  codeVerifier: string;
  returnPath: string;
  shopId: string;
  clientId: string;
  redirectUri: string;
  issuer: string;
  createdAt: number;
  expiresAt: number;
};

export type CustomerAuthorizationCallback = {
  status: "code_received";
  code: string;
  returnPath: string;
} | {
  status: "denied";
  returnPath: string;
} | {
  status: "invalid";
  reason: "callback" | "transaction" | "expired" | "configuration_changed" | "state" | "browser";
};

/** The return destination is app navigation, never an arbitrary redirect. */
export function reviewReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/u.test(value)) return "/";
  try {
    const url = new URL(value, "https://return.invalid");
    const path = decodeURIComponent(url.pathname);
    const productPath = /^\/products\/[\p{L}\p{N}][\p{L}\p{N}_-]*\/?$/u.test(path);
    if (url.origin !== "https://return.invalid" || !(productPath || path === "/reviews/mine" || path === "/")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** Safe lookup key for state or browser binding; reject oversized proofs early. */
export function customerAuthorizationProofHash(value: unknown): string | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  return createHash("sha256").update(value).digest("hex");
}

export function customerAuthorizationChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function matchesHash(value: unknown, expected: string) {
  const actual = customerAuthorizationProofHash(value);
  return actual !== null && /^[a-f0-9]{64}$/.test(expected) && timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

/**
 * Prepare only: persist `attempt` successfully BEFORE setting the opaque cookie
 * and redirecting. Never send the attempt, nonce record, or verifier to clients.
 */
export function prepareCustomerAuthorization({ config, endpoints, returnTo, now = Date.now() }: {
  config: CustomerAccountConfig;
  endpoints: CustomerAccountEndpoints;
  returnTo: unknown;
  now?: number;
}) {
  const authorizationUrl = publicHttpsUrl(endpoints.authorizationEndpoint);
  if (!authorizationUrl || endpoints.issuer !== customerAccountIssuer(config.shopId)) throw new Error("Customer authorization endpoints do not match the configured shop.");
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Customer authorization requires a valid creation time.");
  const state = randomBytes(32).toString("base64url");
  const browserBinding = randomBytes(32).toString("base64url");
  const attempt: CustomerAuthorizationAttempt = {
    stateHash: customerAuthorizationProofHash(state)!,
    browserBindingHash: customerAuthorizationProofHash(browserBinding)!,
    nonce: randomBytes(32).toString("base64url"),
    codeVerifier: randomBytes(48).toString("base64url"),
    returnPath: reviewReturnPath(returnTo),
    shopId: config.shopId,
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    issuer: endpoints.issuer,
    createdAt: now,
    expiresAt: now + customerAuthorizationLifetime * 1000,
  };
  authorizationUrl.searchParams.set("scope", "openid email customer-account-api:full");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", attempt.nonce);
  authorizationUrl.searchParams.set("code_challenge", customerAuthorizationChallenge(attempt.codeVerifier));
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return {
    authorizationUrl: authorizationUrl.href,
    attempt,
    cookie: {
      name: customerAuthorizationCookie,
      value: browserBinding,
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: customerAuthorizationLifetime,
    },
  };
}

/**
 * Validates a callback against a SERVER-LOADED attempt. This is not a login and
 * does not consume the record. The caller must atomically consume it once,
 * exchange the code, verify the signed ID token and nonce, and persist a session
 * before recognizing a buyer. `denied` attempts must also be retired.
 */
export function validateCustomerAuthorizationCallback({ config, endpoints, attempt, callbackUrl, browserBinding, now = Date.now() }: {
  config: CustomerAccountConfig;
  endpoints: CustomerAccountEndpoints;
  attempt: CustomerAuthorizationAttempt | null;
  callbackUrl: string;
  browserBinding: string | undefined;
  now?: number;
}): CustomerAuthorizationCallback {
  let url: URL;
  try {
    url = new URL(callbackUrl);
    const expected = new URL(config.redirectUri);
    if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.username || url.password || url.hash) return { status: "invalid", reason: "callback" };
  } catch {
    return { status: "invalid", reason: "callback" };
  }
  if (!attempt || reviewReturnPath(attempt.returnPath) !== attempt.returnPath || !Number.isSafeInteger(attempt.createdAt) ||
    !Number.isSafeInteger(attempt.expiresAt) || attempt.createdAt < 0 || attempt.expiresAt !== attempt.createdAt + customerAuthorizationLifetime * 1000 ||
    !/^[A-Za-z0-9_-]{43}$/.test(attempt.nonce) || !/^[A-Za-z0-9_-]{64}$/.test(attempt.codeVerifier)) return { status: "invalid", reason: "transaction" };
  if (!Number.isSafeInteger(now) || attempt.createdAt > now || now >= attempt.expiresAt) return { status: "invalid", reason: "expired" };
  if (attempt.shopId !== config.shopId || attempt.clientId !== config.clientId || attempt.redirectUri !== config.redirectUri ||
    attempt.issuer !== endpoints.issuer || endpoints.issuer !== customerAccountIssuer(config.shopId)) return { status: "invalid", reason: "configuration_changed" };
  if (url.searchParams.getAll("state").length !== 1 || !matchesHash(url.searchParams.get("state"), attempt.stateHash)) return { status: "invalid", reason: "state" };
  if (!matchesHash(browserBinding, attempt.browserBindingHash)) return { status: "invalid", reason: "browser" };

  const errors = url.searchParams.getAll("error");
  const codes = url.searchParams.getAll("code");
  if (errors.length === 1 && errors[0] && !codes.length) return { status: "denied", returnPath: attempt.returnPath };
  if (errors.length || codes.length !== 1 || !codes[0] || codes[0].length > 4096 || /[\s\u0000-\u001f\u007f]/u.test(codes[0])) return { status: "invalid", reason: "callback" };
  return { status: "code_received", code: codes[0], returnPath: attempt.returnPath };
}
