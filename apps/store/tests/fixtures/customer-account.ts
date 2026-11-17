import type { CustomerAccountConfig } from "../../lib/customer-account/config";

/** Synthetic configuration and public metadata; never use a real client secret. */
export const customerAccountConfig: CustomerAccountConfig = {
  shopDomain: "review-test.myshopify.com",
  shopId: "123456",
  clientId: "test-customer-client",
  clientSecret: "synthetic-client-secret",
  redirectUri: "https://store.test/api/reviews/auth/callback",
};

export const customerAccountMetadata = {
  issuer: "https://shopify.com/authentication/123456",
  authorization_endpoint: "https://shopify.com/authentication/123456/oauth/authorize",
  token_endpoint: "https://shopify.com/authentication/123456/oauth/token",
  end_session_endpoint: "https://shopify.com/authentication/123456/logout",
  jwks_uri: "https://shopify.com/authentication/123456/.well-known/jwks.json",
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["client_secret_basic"],
};
