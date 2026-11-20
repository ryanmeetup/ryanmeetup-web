import "server-only";

import { apiError } from "@/lib/server/api-response";
import { privilegedContext } from "@/lib/server/privileged-api";
import { getStoreCustomerAuthScope } from "@/lib/server/store-customer-auth/scope";

/**
 * The Tasks owner session plus the pinned store backend, for every staff
 * review route. A storefront service credential never authorizes staff
 * operations, and an instance without the store backend (PRD) answers 503.
 */
export async function storeReviewStaffContext() {
  const owner = await privilegedContext({ owner: true });
  if ("response" in owner) return owner;
  const scope = getStoreCustomerAuthScope();
  return scope ? { ...owner, shopId: scope.shopId } : {
    response: apiError(503, "SERVICE_UNAVAILABLE", "Store review moderation is not configured for this instance."),
  };
}
