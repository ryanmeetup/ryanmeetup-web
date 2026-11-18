/**
 * Formats shared across customer sign-in. One definition per format keeps the
 * checks at each trust boundary (environment, Shopify, storage) in agreement.
 */

/** 32 random bytes in base64url: state, browser binding, nonce, session ID, service token. */
export const isRandomProof = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

/** 48 random bytes in base64url, the PKCE code verifier. */
export const isCodeVerifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{64}$/.test(value);

/** An OAuth token or code: printable ASCII with a sane length. */
export const isTokenText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 16384 && /^[\x21-\x7e]+$/u.test(value);

/** A shop's permanent `*.myshopify.com` domain, without scheme or path. */
export const isMyshopifyDomain = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value);

/** Shopify's numeric shop ID. */
export const isShopId = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]*$/.test(value);
