import { createHmac } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreDatabase, getStoreShopId } from "./store-database";
import { privateJson } from "./request-guard";

export type ReviewWriteAction = "submit" | "edit";
export type ReviewWriteLimit = { allowed: true } | { allowed: false; retryAfter: number };
/** Resolves to the budget decision; rejects when the budget cannot be checked. */
export type ReviewWriteLimiter = (action: ReviewWriteAction, actor: { subject: string; request: Request }) => Promise<ReviewWriteLimit>;
type Rule = { bucket: string; actor: string; limit: number; windowSeconds: number };

const HOUR = 3600;
const DAY = 86_400;

/**
 * Generous for a buyer reviewing a whole order in one sitting, tight enough
 * that a script cannot bury the moderation queue. A new review can come from a
 * throwaway Shopify account, so submissions are also budgeted per network.
 * Edits need an existing review on the account, so the buyer budget suffices.
 * Withdrawing a review is never limited.
 */
export const REVIEW_WRITE_BUDGETS = {
  submit: { buyerPerHour: 10, buyerPerDay: 30, networkPerHour: 20 },
  edit: { buyerPerHour: 20 },
} as const;

/**
 * The client address as the hosting platform reports it. Vercel sets
 * `x-real-ip` and overwrites `x-forwarded-for`, so neither can be spoofed there.
 */
export function clientAddress(request: Request): string | null {
  const candidates = [request.headers.get("x-real-ip"), request.headers.get("x-forwarded-for")?.split(",")[0]];
  for (const candidate of candidates) {
    const value = candidate?.trim().replace(/^\[(.*)\]$/, "$1");
    if (value && (isIPv4(value) || isIPv6(value))) return value;
  }
  return null;
}

/** One IPv4 address, or the /64 an IPv6 address belongs to, since a single line hands out a whole /64. */
export function clientNetwork(address: string): string | null {
  if (isIPv4(address)) return address;
  if (!isIPv6(address)) return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)?.[1];
  if (mapped && isIPv4(mapped)) return mapped;
  const [head, tail] = address.toLowerCase().split("::");
  const groups = (part: string | undefined) => part ? part.split(":").flatMap((group) => group.includes(".") ? ["0", "0"] : [group]) : [];
  const left = groups(head);
  const right = groups(tail);
  const full = tail === undefined ? left : [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right];
  return `${full.slice(0, 4).map((group) => group.padStart(4, "0")).join(":")}::/64`;
}

/** The fixed rules for one write. Network keys are keyed hashes; raw addresses never leave the server. */
export function reviewWriteRules(action: ReviewWriteAction, subject: string, network: string | null, secret: string): Rule[] {
  if (action === "edit") return [{ bucket: "edit:buyer", actor: subject, limit: REVIEW_WRITE_BUDGETS.edit.buyerPerHour, windowSeconds: HOUR }];
  const budget = REVIEW_WRITE_BUDGETS.submit;
  const rules: Rule[] = [
    { bucket: "submit:buyer", actor: subject, limit: budget.buyerPerHour, windowSeconds: HOUR },
    { bucket: "submit:buyer-day", actor: subject, limit: budget.buyerPerDay, windowSeconds: DAY },
  ];
  if (network) {
    const actor = createHmac("sha256", secret).update(`store-review-network:${network}`).digest("hex");
    rules.push({ bucket: "submit:network", actor, limit: budget.networkPerHour, windowSeconds: HOUR });
  }
  return rules;
}

// PostgREST and Postgres codes for a function the database does not have yet.
const missingFunction = new Set(["PGRST202", "42883"]);
let reportedMissing = false;

/**
 * Store server only. A database without the budget function (the migration
 * has not landed yet) lets writes through so deploy and migration can ship in
 * either order; every other failure rejects, and the caller refuses the write.
 */
export function createReviewWriteLimiter({ database, shopId, secret }: { database: SupabaseClient; shopId: string; secret: string }): ReviewWriteLimiter {
  return async (action, { subject, request }) => {
    const address = clientAddress(request);
    const rules = reviewWriteRules(action, subject, address ? clientNetwork(address) : null, secret);
    const result = await database.rpc("store_consume_review_write_budget", { p_shop_id: shopId, p_rules: rules }).abortSignal(AbortSignal.timeout(5_000));
    if (result.error) {
      if (result.error.code && missingFunction.has(result.error.code)) {
        if (!reportedMissing) { reportedMissing = true; console.error(JSON.stringify({ event: "store_review_write_budget_missing" })); }
        return { allowed: true };
      }
      throw new Error("Review write budget unavailable.");
    }
    const value = result.data as { allowed?: unknown; retryAfter?: unknown } | null;
    if (value?.allowed === true) return { allowed: true };
    if (value?.allowed === false && Number.isInteger(value.retryAfter) && (value.retryAfter as number) >= 1 && (value.retryAfter as number) <= DAY) {
      return { allowed: false, retryAfter: value.retryAfter as number };
    }
    throw new Error("Review write budget returned an unexpected result.");
  };
}

export function getReviewWriteLimiter(env: NodeJS.ProcessEnv = process.env): ReviewWriteLimiter | null {
  const database = getStoreDatabase(env);
  const shopId = getStoreShopId(env);
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  return database && shopId && secret ? createReviewWriteLimiter({ database, shopId, secret }) : null;
}

function waitPhrase(seconds: number) {
  if (seconds < 90) return "about a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `about ${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return `about ${hours} hours`;
}

/** A 429 the review UIs show as-is, with the wait in words and in `Retry-After`. */
export function reviewWriteLimited(action: ReviewWriteAction, retryAfter: number) {
  const what = action === "submit" ? "a lot of reviews" : "a lot of review changes";
  const response = privateJson(429, {
    error: `You've sent ${what} in a short time. Even Ryan needs a breather — try again in ${waitPhrase(retryAfter)}.`,
    code: "rate_limited",
  });
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}
