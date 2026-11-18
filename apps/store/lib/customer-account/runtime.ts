import { NextRequest } from "next/server";
import { resolveReviewProvider, reviewPreviewCookie } from "../review-provider";
import { getCustomerAccountConfiguration } from "./config";
import { discoverCustomerAccountEndpoints } from "./discovery";
import { getCustomerAccountEncryptionKeys } from "./secrets";
import { createCustomerAuthBackend } from "./backend";
import { createCustomerAccountStorage } from "./storage";
import { createCustomerAccountTokenClient } from "./tokens";
import type { CustomerSignInService } from "./sign-in";

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
