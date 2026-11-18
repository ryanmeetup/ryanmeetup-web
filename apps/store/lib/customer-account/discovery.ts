import { customerAccountIssuer, publicHttpsUrl } from "./config";
import type { CustomerAccountConfig } from "./config";
import { isMyshopifyDomain, isShopId } from "./formats";

export type CustomerAccountEndpoints = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  logoutEndpoint: string;
  jwksUri: string;
};

export type CustomerAccountDiscovery = {
  status: "available";
  endpoints: CustomerAccountEndpoints;
} | {
  status: "unavailable";
  reason: "provider_failure" | "invalid_metadata" | "wrong_shop" | "unsupported_authentication";
};

/**
 * Public metadata only. No client secret, cookies, or buyer tokens are sent.
 * https://shopify.dev/docs/api/customer/2026-10#discovery-endpoints
 */
export async function discoverCustomerAccountEndpoints(config: Pick<CustomerAccountConfig, "shopDomain" | "shopId">): Promise<CustomerAccountDiscovery> {
  // Also guard callers using this preflight before full client configuration.
  if (!isMyshopifyDomain(config.shopDomain) || !isShopId(config.shopId)) {
    return { status: "unavailable", reason: "invalid_metadata" };
  }
  let data: unknown;
  try {
    const response = await fetch(`https://${config.shopDomain}/.well-known/openid-configuration`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { status: "unavailable", reason: "provider_failure" };
    data = await response.json();
  } catch {
    return { status: "unavailable", reason: "provider_failure" };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) return { status: "unavailable", reason: "invalid_metadata" };
  const metadata = data as Record<string, unknown>;
  if (metadata.issuer !== customerAccountIssuer(config.shopId)) return { status: "unavailable", reason: "wrong_shop" };
  const authorization = publicHttpsUrl(metadata.authorization_endpoint);
  const token = publicHttpsUrl(metadata.token_endpoint);
  const logout = publicHttpsUrl(metadata.end_session_endpoint);
  const jwks = publicHttpsUrl(metadata.jwks_uri);
  if (!authorization || !token || !logout || !jwks) return { status: "unavailable", reason: "invalid_metadata" };
  if (!Array.isArray(metadata.code_challenge_methods_supported) || !metadata.code_challenge_methods_supported.includes("S256") ||
    !Array.isArray(metadata.token_endpoint_auth_methods_supported) || !metadata.token_endpoint_auth_methods_supported.includes("client_secret_basic")) {
    return { status: "unavailable", reason: "unsupported_authentication" };
  }
  return {
    status: "available",
    endpoints: {
      issuer: metadata.issuer,
      authorizationEndpoint: authorization.href,
      tokenEndpoint: token.href,
      logoutEndpoint: logout.href,
      jwksUri: jwks.href,
    },
  };
}
