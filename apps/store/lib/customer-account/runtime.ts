import { NextRequest } from "next/server";
import { resolveReviewProvider, reviewPreviewCookie } from "../review-provider";
import { customerAccountIssuer, getCustomerAccountConfiguration } from "./config";
import { discoverCustomerAccountEndpoints } from "./discovery";
import { getCustomerAccountEncryptionKeys } from "./secrets";
import { createCustomerAuthBackend } from "./backend";
import { createCustomerAccountStorage } from "./storage";
import { createCustomerAccountTokenClient } from "./tokens";
import { customerSessionCookie } from "./sign-in";
import type { CustomerSignInService } from "./sign-in";
import { createCustomerSessionLoader } from "./session";
import type { CustomerSessionResult } from "./session";

/** Compose server credentials at request time; absent dependencies stay closed. */
export function getCustomerAccountStorageService(request: Request, { logout = false } = {}) {
  const preview = new NextRequest(request.url, { headers: request.headers }).cookies.get(reviewPreviewCookie)?.value;
  if (!logout && (process.env.STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED !== "true" || resolveReviewProvider(preview) !== "custom")) return null;
  const configuration = getCustomerAccountConfiguration();
  const encryption = getCustomerAccountEncryptionKeys();
  if (configuration.status !== "configured" || encryption.status !== "configured") return null;
  try {
    const backend = createCustomerAuthBackend({ origin: process.env.STORE_REVIEWS_BACKEND_URL ?? "", token: process.env.STORE_REVIEWS_BACKEND_TOKEN ?? "" });
    const config = configuration.config;
    return { config, storage: createCustomerAccountStorage({ config, keyring: encryption.keyring, backend }) };
  } catch { return null; }
}

export async function getCustomerSignInService(request: Request): Promise<CustomerSignInService | null> {
  const persistence = getCustomerAccountStorageService(request);
  if (!persistence) return null;
  const discovered = await discoverCustomerAccountEndpoints(persistence.config);
  if (discovered.status !== "available") return null;
  return { ...persistence, endpoints: discovered.endpoints,
    tokens: createCustomerAccountTokenClient({ config: persistence.config, endpoints: discovered.endpoints }) };
}

/** Server use only. Healthy sessions do not depend on Shopify discovery. */
export async function getCustomerAccountSession(request: Request): Promise<CustomerSessionResult> {
  const persistence = getCustomerAccountStorageService(request);
  if (!persistence) return { status: "unavailable" };
  const id = new NextRequest(request.url, { headers: request.headers }).cookies.get(customerSessionCookie)?.value;
  const { config, storage } = persistence;
  const load = createCustomerSessionLoader({
    storage, backendOrigin: process.env.STORE_REVIEWS_BACKEND_URL ?? "",
    scope: { shopId: config.shopId, clientId: config.clientId, issuer: customerAccountIssuer(config.shopId), redirectUri: config.redirectUri },
    refresh: async (session, now) => {
      const discovered = await discoverCustomerAccountEndpoints(config);
      if (discovered.status !== "available") throw new Error("Customer session renewal is unavailable.");
      return createCustomerAccountTokenClient({ config, endpoints: discovered.endpoints }).refresh(session, now);
    },
  });
  return load(id);
}
