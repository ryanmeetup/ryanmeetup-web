import { prepareCustomerAuthorization, validateCustomerAuthorizationCallback } from "./authorization";
import type { CustomerAccountConfig } from "./config";
import type { CustomerAccountEndpoints } from "./discovery";
import type { CustomerAccountStorage } from "./storage";
import type { CustomerAccountTokenClient } from "./tokens";

export const customerSessionCookie = "__Host-store-customer-session";
export const customerSessionLifetime = 7 * 86400;

export type CustomerSignInService = {
  config: CustomerAccountConfig;
  endpoints: CustomerAccountEndpoints;
  storage: CustomerAccountStorage;
  tokens: CustomerAccountTokenClient;
};

/** Persistence succeeds before the caller sets a cookie or redirects to Shopify. */
export async function beginCustomerSignIn(service: CustomerSignInService, returnTo: unknown) {
  const prepared = prepareCustomerAuthorization({ config: service.config, endpoints: service.endpoints, returnTo });
  await service.storage.saveAuthorization(prepared.attempt);
  return { authorizationUrl: prepared.authorizationUrl, cookie: prepared.cookie };
}

/** No identity is established by a code alone; consumption precedes exchange. */
export async function completeCustomerSignIn(service: CustomerSignInService, callbackUrl: string, browserBinding: string | undefined) {
  const url = new URL(callbackUrl);
  if (url.searchParams.getAll("state").length !== 1) return { status: "invalid" } as const;
  const attempt = await service.storage.loadAuthorization(url.searchParams.get("state"), browserBinding);
  const checked = validateCustomerAuthorizationCallback({ config: service.config, endpoints: service.endpoints, attempt, callbackUrl, browserBinding });
  if (checked.status === "invalid" || !attempt) return { status: "invalid" } as const;
  if (!await service.storage.consumeAuthorization(attempt)) return { status: "invalid" } as const;
  if (checked.status === "denied") return { status: "denied", returnPath: checked.returnPath } as const;
  const verified = await service.tokens.exchange({ code: checked.code, codeVerifier: attempt.codeVerifier, nonce: attempt.nonce });
  const created = await service.storage.createSession({ ...verified, expiresAt: Date.now() + customerSessionLifetime * 1000 });
  return { status: "signed_in", returnPath: checked.returnPath, id: created.id } as const;
}
