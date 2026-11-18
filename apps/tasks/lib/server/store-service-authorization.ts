import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { CustomerAuthScope } from "@ryanmeetup/reviews";
import { getAdminClient } from "@/lib/server/admin-client";
import { apiError } from "@/lib/server/api-response";
import { getStoreCustomerAuthScope } from "./store-customer-auth/scope";

/**
 * The storefront's server-to-server credential. One token guards every store
 * service route (customer auth and reviews), pinned to the configured shop.
 */
export function authorizeStoreService(request: Request):
  | { response: ReturnType<typeof apiError> }
  | { admin: NonNullable<ReturnType<typeof getAdminClient>>; scope: CustomerAuthScope } {
  const scope = getStoreCustomerAuthScope();
  const tokenHash = process.env.STORE_REVIEWS_SERVICE_TOKEN_SHA256 ?? "";
  if (!scope || !/^[a-f0-9]{64}$/.test(tokenHash)) {
    return { response: apiError(503, "SERVICE_UNAVAILABLE", "Store services are unavailable.") };
  }
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const actual = createHash("sha256").update(token ?? "").digest();
  if (!token || !timingSafeEqual(actual, Buffer.from(tokenHash, "hex"))) {
    return { response: apiError(401, "AUTH_REQUIRED", "A valid store service credential is required.", {
      "WWW-Authenticate": 'Bearer realm="Store services"',
    }) };
  }
  if (request.headers.has("origin") || request.headers.has("sec-fetch-site")) {
    return { response: apiError(403, "ORIGIN_REJECTED", "This endpoint accepts server requests only.") };
  }
  const admin = getAdminClient();
  return admin ? { admin, scope } : { response: apiError(503, "SERVICE_UNAVAILABLE", "Store services are unavailable.") };
}
