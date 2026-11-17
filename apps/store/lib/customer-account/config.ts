import { isIP } from "node:net";

export const customerAccountCallbackPath = "/api/reviews/auth/callback";

export const customerAccountEnvironmentKeys = [
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID",
  "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID",
  "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET",
  "SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI",
] as const;

type ConfigurationKey = typeof customerAccountEnvironmentKeys[number];

/** Server-owned configuration. Never serialize this object into a response. */
export type CustomerAccountConfig = {
  shopDomain: string;
  shopId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type CustomerAccountConfiguration = {
  status: "configured";
  config: CustomerAccountConfig;
} | {
  status: "unavailable";
  missing: ConfigurationKey[];
  invalid: ConfigurationKey[];
};

export function publicHttpsUrl(value: unknown): URL | null {
  if (typeof value !== "string" || /[\s\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      hostname === "localhost" || hostname.endsWith(".localhost") || isIP(hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

/** No fallback to Admin or Judge.me credentials: these authenticate a buyer. */
export function getCustomerAccountConfiguration(env: Readonly<Record<string, string | undefined>> = process.env): CustomerAccountConfiguration {
  const values = Object.fromEntries(customerAccountEnvironmentKeys.map((key) => [key, env[key]?.trim() ?? ""])) as Record<ConfigurationKey, string>;
  const missing = customerAccountEnvironmentKeys.filter((key) => !values[key]);
  const invalid: ConfigurationKey[] = [];
  const check = (key: ConfigurationKey, valid: boolean) => {
    if (values[key] && !valid) invalid.push(key);
  };

  check("SHOPIFY_STORE_DOMAIN", /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(values.SHOPIFY_STORE_DOMAIN));
  check("SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID", /^[1-9]\d*$/.test(values.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID));
  check("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID", /^[^\s:\u0000-\u001f\u007f]{1,200}$/u.test(values.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID));
  check("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET", values.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET.length <= 4096 && !/[\u0000-\u001f\u007f]/u.test(values.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET));
  const redirect = publicHttpsUrl(values.SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI);
  check("SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI", Boolean(redirect && redirect.pathname === customerAccountCallbackPath && !redirect.search));

  if (missing.length || invalid.length) return { status: "unavailable", missing, invalid };
  return {
    status: "configured",
    config: {
      shopDomain: values.SHOPIFY_STORE_DOMAIN,
      shopId: values.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID,
      clientId: values.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
      clientSecret: values.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET,
      redirectUri: redirect!.href,
    },
  };
}

export function customerAccountIssuer(shopId: string) {
  return `https://shopify.com/authentication/${shopId}`;
}
