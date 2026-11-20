import type { CustomerAccountConfig } from "../../lib/customer-account/config";
import { fakeSupabaseEnvironment } from "./customer-auth-backend";

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

/** Complete synthetic server environment; never configure a live deployment with it. */
export const customerAccountEnvironment = {
  STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED: "true", VERCEL_ENV: "preview",
  SHOPIFY_STORE_DOMAIN: customerAccountConfig.shopDomain, SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: customerAccountConfig.shopId,
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: customerAccountConfig.clientId, SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET: customerAccountConfig.clientSecret,
  SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI: customerAccountConfig.redirectUri, ...fakeSupabaseEnvironment, STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEY_ID: "test",
  STORE_CUSTOMER_ACCOUNT_ENCRYPTION_KEYS: JSON.stringify({ test: Buffer.alloc(32, 7).toString("base64url") }),
};
