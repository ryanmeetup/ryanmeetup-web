import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, customFetch, decodeJwt, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { customerAccountIssuer, publicHttpsUrl } from "./config";
import type { CustomerAccountConfig } from "./config";
import type { CustomerAccountEndpoints } from "./discovery";
import type { CustomerAccountSession, CustomerAccountTokens } from "./storage";

export class CustomerAccountTokenError extends Error {
  constructor() { super("Shopify sign-in could not be verified. Please try again."); }
}

/** Only a definitive invalid_grant response means this session needs sign-in. */
export class CustomerAccountRefreshRejected extends CustomerAccountTokenError {}

function sameProof(actual: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}

const tokenText = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 16384 && /^[\x21-\x7e]+$/u.test(value);

function audiences(value: unknown): string[] {
  const values = typeof value === "string" ? [value] : value;
  if (!Array.isArray(values) || !values.length || !values.every((item) => typeof item === "string" && item.length > 0)) throw new CustomerAccountTokenError();
  return [...values].sort();
}

function validIdentity(payload: JWTPayload, config: CustomerAccountConfig): payload is JWTPayload & { sub: string } {
  return payload.iss === customerAccountIssuer(config.shopId) &&
    typeof payload.sub === "string" && payload.sub.length > 0 && payload.sub.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(payload.sub) &&
    audiences(payload.aud).includes(config.clientId) &&
    (payload.azp === undefined || payload.azp === config.clientId) &&
    (!Array.isArray(payload.aud) || payload.aud.length <= 1 || payload.azp === config.clientId);
}

function verifyAccessHash(payload: JWTPayload, accessToken: string) {
  if (payload.at_hash === undefined) return;
  const expected = createHash("sha256").update(accessToken).digest().subarray(0, 16).toString("base64url");
  if (typeof payload.at_hash !== "string" || !sameProof(payload.at_hash, expected)) throw new CustomerAccountTokenError();
}

/** Confidential Headless client; never accept a browser-supplied token endpoint. */
export function createCustomerAccountTokenClient({ config, endpoints, fetcher = fetch }: {
  config: CustomerAccountConfig;
  endpoints: CustomerAccountEndpoints;
  fetcher?: typeof fetch;
}) {
  if (endpoints.issuer !== customerAccountIssuer(config.shopId) || !publicHttpsUrl(endpoints.tokenEndpoint) || !publicHttpsUrl(endpoints.jwksUri)) throw new CustomerAccountTokenError();
  const keys = createRemoteJWKSet(new URL(endpoints.jwksUri), {
    timeoutDuration: 5000,
    [customFetch]: (url, options) => fetcher(url, { ...options, redirect: "error", cache: "no-store" }),
  });

  async function requestTokens(body: URLSearchParams, now: number, refreshing = false) {
    if (!Number.isSafeInteger(now) || now < 0) throw new CustomerAccountTokenError();
    const response = await fetcher(endpoints.tokenEndpoint, {
      method: "POST", headers: {
        "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        Origin: new URL(config.redirectUri).origin, "User-Agent": "RyanMeetupStore/CustomerSignIn",
      },
      body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    if (Buffer.byteLength(text) > 64 * 1024) throw new CustomerAccountTokenError();
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new CustomerAccountTokenError();
    const result = data as Record<string, unknown>;
    if (!response.ok) {
      if (refreshing && response.status === 400 && result.error === "invalid_grant") throw new CustomerAccountRefreshRejected();
      throw new CustomerAccountTokenError();
    }
    if (!tokenText(result.access_token) || (result.refresh_token !== undefined && !tokenText(result.refresh_token)) ||
      (result.id_token !== undefined && !tokenText(result.id_token)) ||
      typeof result.token_type !== "string" || result.token_type.toLowerCase() !== "bearer" ||
      typeof result.expires_in !== "number" || !Number.isSafeInteger(result.expires_in) || result.expires_in <= 0 || result.expires_in > 30 * 86400) throw new CustomerAccountTokenError();
    return { accessToken: result.access_token, refreshToken: result.refresh_token as string | undefined,
      idToken: result.id_token as string | undefined, accessExpiresAt: now + result.expires_in * 1000 };
  }

  async function verifyIdentity(idToken: string, now: number, requireNonce: boolean) {
    const { payload } = await jwtVerify(idToken, keys, {
      algorithms: ["RS256"], issuer: endpoints.issuer, audience: config.clientId,
      requiredClaims: ["sub", "iat", "exp", ...(requireNonce ? ["nonce"] : [])],
      maxTokenAge: "10 minutes", clockTolerance: 30, currentDate: new Date(now),
    });
    if (!validIdentity(payload, config)) throw new CustomerAccountTokenError();
    return payload;
  }

  return {
    async exchange({ code, codeVerifier, nonce, now = Date.now() }: {
      code: string; codeVerifier: string; nonce: string; now?: number;
    }): Promise<{ subject: string; tokens: CustomerAccountTokens; accessExpiresAt: number }> {
      try {
        if (!tokenText(code) || !/^[A-Za-z0-9_-]{64}$/.test(codeVerifier) || !/^[A-Za-z0-9_-]{43}$/.test(nonce) || !Number.isSafeInteger(now) || now < 0) throw new CustomerAccountTokenError();
        const body = new URLSearchParams({ grant_type: "authorization_code", client_id: config.clientId, redirect_uri: config.redirectUri, code, code_verifier: codeVerifier });
        const result = await requestTokens(body, now);
        if (!result.refreshToken || !result.idToken) throw new CustomerAccountTokenError();
        const payload = await verifyIdentity(result.idToken, now, true);
        if (typeof payload.nonce !== "string" || !sameProof(payload.nonce, nonce)) throw new CustomerAccountTokenError();
        verifyAccessHash(payload, result.accessToken);
        return { subject: payload.sub, tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken, idToken: result.idToken }, accessExpiresAt: result.accessExpiresAt };
      } catch {
        // OAuth bodies and JWT/JWKS errors can contain tokens or claims.
        throw new CustomerAccountTokenError();
      }
    },

    /** Takes only a session loaded from authenticated encrypted server storage. */
    async refresh(session: CustomerAccountSession, now = Date.now()): Promise<{ tokens: CustomerAccountTokens; accessExpiresAt: number }> {
      try {
        if (!tokenText(session.tokens.refreshToken) || !tokenText(session.tokens.idToken) || session.expiresAt <= now || session.createdAt > now) throw new CustomerAccountTokenError();
        // The original token was verified at sign-in and is protected by the
        // session envelope. Its expiry does not end the separate RP session.
        // Keep this original anchor across refreshes, even when new ID tokens
        // omit nonce/auth_time, so a later response can still be compared.
        const original = decodeJwt(session.tokens.idToken);
        if (!validIdentity(original, config) || original.sub !== session.subject ||
          typeof original.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(original.nonce)) throw new CustomerAccountTokenError();
        const result = await requestTokens(new URLSearchParams({ grant_type: "refresh_token", client_id: config.clientId, refresh_token: session.tokens.refreshToken }), now, true);
        if (result.idToken !== undefined) {
          const payload = await verifyIdentity(result.idToken, now, false);
          if (payload.sub !== original.sub || JSON.stringify(audiences(payload.aud)) !== JSON.stringify(audiences(original.aud)) ||
            (payload.auth_time !== undefined && payload.auth_time !== original.auth_time) ||
            (payload.nonce !== undefined && (typeof payload.nonce !== "string" || !sameProof(payload.nonce, original.nonce)))) throw new CustomerAccountTokenError();
          verifyAccessHash(payload, result.accessToken);
        }
        return { tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken ?? session.tokens.refreshToken,
          idToken: session.tokens.idToken }, accessExpiresAt: result.accessExpiresAt };
      } catch (error) {
        if (error instanceof CustomerAccountRefreshRejected) throw error;
        throw new CustomerAccountTokenError();
      }
    },
  };
}

export type CustomerAccountTokenClient = ReturnType<typeof createCustomerAccountTokenClient>;
