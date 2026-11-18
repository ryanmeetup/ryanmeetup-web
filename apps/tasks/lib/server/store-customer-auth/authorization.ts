import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { customerAuthScopeSchema } from "@ryanmeetup/reviews";
import type { CustomerAuthScope } from "@ryanmeetup/reviews";
import { getAdminClient } from "@/lib/server/admin-client";
import { apiError } from "@/lib/server/api-response";

// This service is an RMT extension. A copied flag/token must never enable it
// against the personal PRD database, including after a fresh build.
const rmtProject = "lvfaartgcpphuokoswcm";
const personalProject = "vjsnobmfsfrsnwukfaoq";

export function authorizeStoreCustomerAuth(request: Request):
  | { response: ReturnType<typeof apiError> }
  | { admin: NonNullable<ReturnType<typeof getAdminClient>>; scope: CustomerAuthScope } {
  let scope;
  try { scope = customerAuthScopeSchema(JSON.parse(process.env.STORE_REVIEWS_CUSTOMER_AUTH_SCOPE ?? "")); }
  catch { scope = null; }
  const tokenHash = process.env.STORE_REVIEWS_SERVICE_TOKEN_SHA256 ?? "";
  // An isolated test backend can pin its own project explicitly. PRD is never
  // a store backend, even if all service configuration is copied there.
  const project = process.env.STORE_REVIEWS_SUPABASE_PROJECT_REF ?? rmtProject;
  if (process.env.STORE_REVIEWS_CUSTOMER_AUTH_ENABLED !== "true" ||
    !/^[a-z]{20}$/.test(project) || project === personalProject ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co` || !scope || !/^[a-f0-9]{64}$/.test(tokenHash)) {
    return { response: apiError(503, "SERVICE_UNAVAILABLE", "Store customer authentication is unavailable.") };
  }
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const actual = createHash("sha256").update(token ?? "").digest();
  if (!token || !timingSafeEqual(actual, Buffer.from(tokenHash, "hex"))) {
    return { response: apiError(401, "AUTH_REQUIRED", "A valid store service credential is required.", {
      "WWW-Authenticate": 'Bearer realm="Store customer authentication"',
    }) };
  }
  if (request.headers.has("origin") || request.headers.has("sec-fetch-site")) {
    return { response: apiError(403, "ORIGIN_REJECTED", "This endpoint accepts server requests only.") };
  }
  const admin = getAdminClient();
  return admin ? { admin, scope } : { response: apiError(503, "SERVICE_UNAVAILABLE", "Store customer authentication is unavailable.") };
}
