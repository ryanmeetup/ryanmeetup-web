import "server-only";

import { customerAuthScopeSchema } from "@ryanmeetup/reviews";

/** Both staff and service routes pin the same enabled store backend. */
export function getStoreCustomerAuthScope() {
  const project = process.env.STORE_REVIEWS_SUPABASE_PROJECT_REF ?? "lvfaartgcpphuokoswcm";
  if (process.env.STORE_REVIEWS_CUSTOMER_AUTH_ENABLED !== "true" ||
    !/^[a-z]{20}$/.test(project) || project === "vjsnobmfsfrsnwukfaoq" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`) return null;
  try { return customerAuthScopeSchema(JSON.parse(process.env.STORE_REVIEWS_CUSTOMER_AUTH_SCOPE ?? "")); }
  catch { return null; }
}
