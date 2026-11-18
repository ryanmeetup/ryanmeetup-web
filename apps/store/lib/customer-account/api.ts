import { publicHttpsUrl } from "./config";
import type { CustomerAccountConfig } from "./config";
import { isMyshopifyDomain, isShopId, isTokenText } from "./formats";

export const customerAccountApiVersion = "2026-10";

export class CustomerAccountApiError extends Error {
  constructor() { super("Purchase information is temporarily unavailable."); }
}

export type CustomerAccountApiEndpoint = { url: string; shopId: string };

function apiUrl(value: unknown, shopId: string): URL | null {
  if (!isShopId(shopId)) return null;
  const url = publicHttpsUrl(value);
  if (!url || url.hostname !== "shopify.com" || url.port || url.search ||
    !new RegExp(`^/${shopId}/account/customer/api/20[0-9]{2}-(01|04|07|10)/graphql$`).test(url.pathname)) return null;
  // Discovery supplies the host/shop route; pin the supported schema version
  // rather than silently following a future latest-version change.
  url.pathname = `/${shopId}/account/customer/api/${customerAccountApiVersion}/graphql`;
  return url;
}

/** Public discovery only. A token is never sent to a caller-selected host/shop. */
export async function discoverCustomerAccountApi(config: Pick<CustomerAccountConfig, "shopDomain" | "shopId">, fetcher = fetch): Promise<CustomerAccountApiEndpoint | null> {
  if (!isMyshopifyDomain(config.shopDomain) || !isShopId(config.shopId)) return null;
  try {
    const response = await fetcher(`https://${config.shopDomain}/.well-known/customer-account-api`, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const url = apiUrl((data as Record<string, unknown>).graphql_api, config.shopId);
    return url ? { url: url.href, shopId: config.shopId } : null;
  } catch { return null; }
}

/** Private customer-token transport; results must be parsed before domain use. */
export function createCustomerAccountApi({ config, endpoint, accessToken, fetcher = fetch }: {
  config: CustomerAccountConfig;
  endpoint: CustomerAccountApiEndpoint;
  accessToken: string;
  fetcher?: typeof fetch;
}) {
  const url = apiUrl(endpoint.url, config.shopId);
  if (!url || url.href !== endpoint.url || endpoint.shopId !== config.shopId ||
    !isTokenText(accessToken)) throw new CustomerAccountApiError();
  const endpointUrl = url.href;
  return async function query(document: string, variables: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await fetcher(endpointUrl, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: accessToken,
          Origin: new URL(config.redirectUri).origin, "User-Agent": "RyanMeetupStore/ReviewPurchases" },
        body: JSON.stringify({ query: document, variables }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new CustomerAccountApiError();
      const servedVersion = response.headers.get("x-shopify-api-version");
      if (servedVersion && servedVersion !== customerAccountApiVersion) throw new CustomerAccountApiError();
      const text = await response.text();
      if (Buffer.byteLength(text) > 512 * 1024) throw new CustomerAccountApiError();
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new CustomerAccountApiError();
      const result = value as Record<string, unknown>;
      if ((result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length > 0)) ||
        !result.data || typeof result.data !== "object" || Array.isArray(result.data)) throw new CustomerAccountApiError();
      return result.data;
    } catch {
      // Shopify errors can contain queries, customer IDs, and access tokens.
      throw new CustomerAccountApiError();
    }
  };
}

export type CustomerAccountApi = ReturnType<typeof createCustomerAccountApi>;
