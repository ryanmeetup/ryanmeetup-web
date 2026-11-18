import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { customerAccountIssuer, publicHttpsUrl } from "./config";
import type { CustomerAccountConfig } from "./config";
import type { CustomerAccountEndpoints } from "./discovery";
import type { CustomerAccountTokens } from "./storage";

export class CustomerAccountTokenError extends Error {
  constructor() { super("Shopify sign-in could not be verified. Please try again."); }
}

function sameProof(actual: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(actual).digest(), createHash("sha256").update(expected).digest());
}

const tokenText = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 16384 && /^[\x21-\x7e]+$/u.test(value);

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

  return {
    async exchange({ code, codeVerifier, nonce, now = Date.now() }: {
      code: string; codeVerifier: string; nonce: string; now?: number;
    }): Promise<{ subject: string; tokens: CustomerAccountTokens; accessExpiresAt: number }> {
      try {
        if (!tokenText(code) || !/^[A-Za-z0-9_-]{64}$/.test(codeVerifier) || !/^[A-Za-z0-9_-]{43}$/.test(nonce) || !Number.isSafeInteger(now) || now < 0) throw new CustomerAccountTokenError();
        const body = new URLSearchParams({ grant_type: "authorization_code", client_id: config.clientId, redirect_uri: config.redirectUri, code, code_verifier: codeVerifier });
        const response = await fetcher(endpoints.tokenEndpoint, {
          method: "POST", headers: {
            "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json",
            Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
            Origin: new URL(config.redirectUri).origin, "User-Agent": "RyanMeetupStore/CustomerSignIn",
          },
          body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new CustomerAccountTokenError();
        const text = await response.text();
        if (Buffer.byteLength(text) > 64 * 1024) throw new CustomerAccountTokenError();
        const data: unknown = JSON.parse(text);
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new CustomerAccountTokenError();
        const result = data as Record<string, unknown>;
        if (!tokenText(result.access_token) || !tokenText(result.refresh_token) || !tokenText(result.id_token) ||
          typeof result.token_type !== "string" || result.token_type.toLowerCase() !== "bearer" ||
          typeof result.expires_in !== "number" || !Number.isSafeInteger(result.expires_in) || result.expires_in <= 0 || result.expires_in > 30 * 86400) throw new CustomerAccountTokenError();
        const { payload } = await jwtVerify(result.id_token, keys, {
          algorithms: ["RS256"], issuer: endpoints.issuer, audience: config.clientId,
          requiredClaims: ["sub", "iat", "exp", "nonce"], maxTokenAge: "10 minutes", clockTolerance: 30, currentDate: new Date(now),
        });
        if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 512 || /[\u0000-\u001f\u007f]/u.test(payload.sub) ||
          typeof payload.nonce !== "string" || !sameProof(payload.nonce, nonce) ||
          (payload.azp !== undefined && payload.azp !== config.clientId) ||
          (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId)) throw new CustomerAccountTokenError();
        if (payload.at_hash !== undefined) {
          const expected = createHash("sha256").update(result.access_token).digest().subarray(0, 16).toString("base64url");
          if (typeof payload.at_hash !== "string" || !sameProof(payload.at_hash, expected)) throw new CustomerAccountTokenError();
        }
        return { subject: payload.sub, tokens: { accessToken: result.access_token, refreshToken: result.refresh_token, idToken: result.id_token }, accessExpiresAt: now + result.expires_in * 1000 };
      } catch {
        // OAuth bodies and JWT/JWKS errors can contain tokens or claims.
        throw new CustomerAccountTokenError();
      }
    },
  };
}

export type CustomerAccountTokenClient = ReturnType<typeof createCustomerAccountTokenClient>;
