import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isShopId } from "./customer-account/formats";

/** The shared Ryan Meetup backend (RMT). Store data never goes anywhere else. */
const rmtUrl = "https://lvfaartgcpphuokoswcm.supabase.co";
const loopback = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

/**
 * Server-only Supabase client for store reviews and buyer sign-in, using the
 * RMT secret key. Any other project is refused, so PRD can never be reached;
 * outside production a loopback URL is allowed for a local stack or test fake.
 */
export function getStoreDatabase(env: NodeJS.ProcessEnv = process.env): SupabaseClient | null {
  const url = env.SUPABASE_URL?.trim() ?? "";
  const key = env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (!key || !(url === rmtUrl || (env.NODE_ENV !== "production" && loopback.test(url)))) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/**
 * True when the store database is a local stack or test fake rather than RMT.
 * Those are reconfigured between requests, so their reads are never cached.
 */
export function isLocalStoreDatabase(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== "production" && loopback.test(env.SUPABASE_URL?.trim() ?? "");
}

/** The Shopify shop whose reviews this store reads and writes. */
export function getStoreShopId(env: NodeJS.ProcessEnv = process.env) {
  const id = env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID;
  return isShopId(id) ? id : null;
}
