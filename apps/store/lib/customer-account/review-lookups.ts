import type { VerifiedReviewPurchase } from "@ryanmeetup/reviews";
import type { ReviewEligibility, ReviewNoneReason, ReviewablePurchaseLine } from "../review-purchases";
import { createCustomerAccountApi, discoverCustomerAccountApi } from "./api";
import { readReviewBuyer, readReviewOrderCandidates } from "./buyer-reader";
import { evaluateReviewPurchase } from "./purchase-eligibility";
import type { EligibleReviewPurchase, ReviewIneligibleReason } from "./purchase-eligibility";
import { readCustomerPurchase } from "./purchase-reader";
import { getCustomerAccountPersistence } from "./runtime";
import { sameCustomerAccountSession } from "./storage";
import type { CustomerAccountSession } from "./storage";

function numericId(value: string, kind: "Order" | "LineItem" | "Product" | "ProductVariant") {
  return new RegExp(`^gid://shopify/${kind}/([1-9][0-9]{0,19})$`).exec(value)?.[1] ?? null;
}
function label(value: string) {
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  return normalized && [...normalized].length <= 255 && !/[\u0000-\u001f\u007f]/u.test(normalized) ? normalized : null;
}

/** Keep reference kinds explicit and IDs as strings, including 64-bit values. */
export function reviewBackendPurchase(purchase: EligibleReviewPurchase): VerifiedReviewPurchase | null {
  const orderId = numericId(purchase.orderId, "Order");
  const lineId = numericId(purchase.lineId, "LineItem");
  const productId = numericId(purchase.productId, "Product");
  const variantId = purchase.variantId === null ? null : numericId(purchase.variantId, "ProductVariant");
  const productTitle = label(purchase.productName);
  const variantTitle = purchase.variantTitle === null ? null : label(purchase.variantTitle);
  if (!orderId || !lineId || !productId || !productTitle || (purchase.variantId !== null && !variantId) ||
    (purchase.variantTitle !== null && !variantTitle)) return null;
  return { orderId, lineId, productId, variantId, productTitle, variantTitle };
}

const lastingReasons = new Set<ReviewIneligibleReason | "history_limit">(["refunded", "edited", "unverifiable", "history_limit"]);

/** The most useful thing to tell a buyer whose lines all failed the rules. */
function noneReason(skipped: Set<ReviewIneligibleReason | "history_limit">): ReviewNoneReason {
  if (skipped.has("unfulfilled") || skipped.has("unpaid")) return "not_shipped";
  return [...skipped].some((reason) => lastingReasons.has(reason)) ? "needs_help" : "not_purchased";
}

/** Reason codes only: no order, line, product, or buyer identifier is logged. */
function logLastingReasons(skipped: Set<ReviewIneligibleReason | "history_limit">) {
  const reasons = [...skipped].filter((reason) => lastingReasons.has(reason)).sort();
  if (reasons.length) console.info("Review purchase lines need a person to check.", { reasons });
}

async function context(session: CustomerAccountSession) {
  const persistence = getCustomerAccountPersistence();
  if (!persistence) return null;
  const stored = await persistence.storage.loadSessionByHash(session.sessionHash);
  if (!stored || !sameCustomerAccountSession(session, stored) || stored.accessExpiresAt <= Date.now()) return null;
  const endpoint = await discoverCustomerAccountApi(persistence.config);
  if (!endpoint) return null;
  const api = createCustomerAccountApi({ config: persistence.config, endpoint, accessToken: stored.tokens.accessToken });
  let requests = 0;
  const query: typeof api = async (document, variables) => {
    if (++requests > 30) throw new Error("Review purchase request budget exceeded.");
    return api(document, variables);
  };
  return {
    query, shopId: persistence.config.shopId,
    /** Readers swallow their own errors, so the budget is checked here, not caught. */
    exhausted: () => requests > 30,
    async active() {
      const current = await persistence.storage.loadSessionByHash(stored.sessionHash);
      return Boolean(current && sameCustomerAccountSession(stored, current) && current.accessExpiresAt > Date.now());
    },
  };
}

/**
 * A product list for the picker and every write; no browser purchase is trusted.
 * Lines that fail the rules are skipped with a reason. Only a failed or
 * inconsistent lookup is `unavailable`, since that can succeed on retry.
 */
export async function lookupReviewablePurchases(session: CustomerAccountSession, productId: string): Promise<ReviewEligibility> {
  if (!/^[1-9][0-9]{0,19}$/.test(productId)) return { status: "unavailable" };
  try {
    const client = await context(session);
    if (!client) return { status: "unavailable" };
    const discovery = await readReviewOrderCandidates(client.query);
    if (!discovery) return { status: "unavailable" };
    const productReference = `gid://shopify/Product/${productId}`;
    const purchases: ReviewablePurchaseLine[] = [];
    const seenLines = new Set<string>();
    const skipped = new Set<ReviewIneligibleReason | "history_limit">();
    for (const candidate of discovery.orders) {
      if (candidate.completeLines && candidate.lines.every((line) => line.productId !== null && line.productId !== productReference)) continue;
      const read = await readCustomerPurchase(client.query, candidate.id);
      // A long order history is lasting, not a provider failure. Every line
      // already collected was fully verified, so the newest orders still count.
      if (client.exhausted()) { skipped.add("history_limit"); break; }
      if (read.status !== "found" || read.purchase.buyerId !== discovery.buyer.id || read.purchase.updatedAt !== candidate.updatedAt) return { status: "unavailable" };
      for (const line of read.purchase.lines) {
        // A deleted product's line can't be this product; it no longer blocks the rest of the order.
        if (line.productId !== productReference) continue;
        const checked = evaluateReviewPurchase(read.purchase, { shopId: client.shopId, lineId: line.id, productId: productReference });
        if (checked.status === "ineligible") { skipped.add(checked.reason); continue; }
        if (checked.status !== "eligible") return { status: "unavailable" };
        const verified = reviewBackendPurchase(checked.purchase);
        if (!verified || verified.productId !== productId || seenLines.has(verified.lineId)) return { status: "unavailable" };
        seenLines.add(verified.lineId);
        purchases.push({ ...verified, label: `Order ${read.purchase.orderLabel}${verified.variantTitle ? ` · ${verified.variantTitle}` : ""}` });
      }
    }
    if (!await client.active()) return { status: "unavailable" };
    logLastingReasons(skipped);
    return purchases.length
      ? { status: "eligible", buyer: { firstName: discovery.buyer.firstName, lastName: discovery.buyer.lastName }, purchases }
      : { status: "none", reason: noneReason(skipped) };
  } catch { return { status: "unavailable" }; }
}

/** Names are fetched from the current customer token, never the browser or draft. */
export async function lookupReviewBuyerName(session: CustomerAccountSession): Promise<{ firstName: string | null; lastName: string | null } | null> {
  try {
    const client = await context(session);
    if (!client) return null;
    const buyer = await readReviewBuyer(client.query);
    if (!buyer || !await client.active()) return null;
    return { firstName: buyer.firstName, lastName: buyer.lastName };
  } catch { return null; }
}
