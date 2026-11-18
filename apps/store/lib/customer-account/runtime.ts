import { readCookie } from "../request-guard";
import { customerAccountIssuer, getCustomerAccountConfiguration } from "./config";
import { discoverCustomerAccountEndpoints } from "./discovery";
import { getCustomerAccountEncryptionKeys } from "./secrets";
import { getStoreDatabase } from "../store-database";
import { createCustomerAuthBackend } from "./backend";
import { createCustomerAccountStorage } from "./storage";
import { createCustomerAccountTokenClient } from "./tokens";
import { customerSessionCookie } from "./sign-in";
import type { CustomerSignInService } from "./sign-in";
import { createCustomerSessionLoader } from "./session";
import type { CustomerSessionResult } from "./session";

/** Server persistence only; callers must separately establish buyer authority. */
export function getCustomerAccountPersistence({ logout = false } = {}) {
  if (!logout && process.env.STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED !== "true") return null;
  const configuration = getCustomerAccountConfiguration();
  const encryption = getCustomerAccountEncryptionKeys();
  if (configuration.status !== "configured" || encryption.status !== "configured") return null;
  const database = getStoreDatabase();
  if (!database) return null;
  const config = configuration.config;
  const scope = { shopId: config.shopId, clientId: config.clientId, issuer: customerAccountIssuer(config.shopId), redirectUri: config.redirectUri };
  const backend = createCustomerAuthBackend({ database, scope });
  return { config, storage: createCustomerAccountStorage({ config, keyring: encryption.keyring, backend }) };
}

/** Compose server credentials at request time; absent dependencies stay closed. */
export function getCustomerAccountStorageService({ logout = false } = {}) {
  return getCustomerAccountPersistence({ logout });
}

export async function getCustomerSignInService(): Promise<CustomerSignInService | null> {
  const persistence = getCustomerAccountStorageService();
  if (!persistence) return null;
  const discovered = await discoverCustomerAccountEndpoints(persistence.config);
  if (discovered.status !== "available") return null;
  return { ...persistence, endpoints: discovered.endpoints,
    tokens: createCustomerAccountTokenClient({ config: persistence.config, endpoints: discovered.endpoints }) };
}

/** Server use only. Healthy sessions do not depend on Shopify discovery. */
export async function getCustomerAccountSession(request: Request): Promise<CustomerSessionResult> {
  const persistence = getCustomerAccountStorageService();
  if (!persistence) return { status: "unavailable" };
  const id = readCookie(request, customerSessionCookie);
  const { config, storage } = persistence;
  const load = createCustomerSessionLoader({
    storage, databaseUrl: process.env.SUPABASE_URL ?? "",
    scope: { shopId: config.shopId, clientId: config.clientId, issuer: customerAccountIssuer(config.shopId), redirectUri: config.redirectUri },
    refresh: async (session, now) => {
      const discovered = await discoverCustomerAccountEndpoints(config);
      if (discovered.status !== "available") throw new Error("Customer session renewal is unavailable.");
      return createCustomerAccountTokenClient({ config, endpoints: discovered.endpoints }).refresh(session, now);
    },
  });
  return load(id);
}
