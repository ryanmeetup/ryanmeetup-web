import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { productActivityRevalidate, productActivityTag } from "./cache-tags";
import { numericProductId } from "./custom-reviews";
import { applyListingHighlights, describeListingMilestone, poolListingActivity, type ListingHighlight, type ProductActivity } from "./listing-highlights";
import { withListingRatings } from "./listing-ratings";
import { currentPromotion, isPromotionLive } from "./promotion";
import { getStoreDatabase, getStoreShopId, isLocalStoreDatabase } from "./store-database";
import type { CatalogSections, ProductListing } from "./types";

/**
 * Anonymous sales and add-to-cart activity in RMT's `store_product_activity`. Rows carry
 * no buyer details: a sale is keyed by its order and line, a cart add by a hash of the cart.
 * Activity is a garnish, so reads fail to null and never block a page.
 */

const table = "store_product_activity";
/** Rows older than this no longer feed any window and are pruned as orders arrive. */
const retentionDays = 180;

type ActivityRow = { shop_id: string; kind: "sale" | "cart_add"; product_id: string; quantity: number; source_key: string; occurred_at: string };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const idText = (value: unknown) => (typeof value === "number" && Number.isSafeInteger(value) && value > 0) || (typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value)) ? String(value) : null;

/**
 * The sale rows in an `orders/create` webhook payload, or null when it isn't an order.
 * Test and cancelled orders count for nothing; lines without a product (custom items,
 * deleted products) are skipped.
 */
export function orderActivityRows(shopId: string, order: unknown): ActivityRow[] | null {
  if (!isRecord(order)) return null;
  const orderId = idText(order.id);
  const createdAt = typeof order.created_at === "string" && !Number.isNaN(Date.parse(order.created_at)) ? new Date(order.created_at).toISOString() : null;
  if (!orderId || !createdAt || !Array.isArray(order.line_items)) return null;
  if (order.test === true || order.cancelled_at) return [];
  return order.line_items.flatMap((line): ActivityRow[] => {
    if (!isRecord(line)) return [];
    const lineId = idText(line.id);
    const productId = idText(line.product_id);
    const quantity = typeof line.quantity === "number" && Number.isInteger(line.quantity) ? Math.min(line.quantity, 1000) : 0;
    if (!lineId || !productId || quantity < 1) return [];
    return [{ shop_id: shopId, kind: "sale", product_id: productId, quantity, source_key: `order:${orderId}:${lineId}`, occurred_at: createdAt }];
  });
}

export type ActivityWriteResult = { recorded: boolean };

/**
 * Records an order's sales. Redelivery is harmless: each line is keyed and kept once.
 * Errors propagate so the webhook answers 500 and Shopify retries.
 */
export async function recordOrderActivity(order: unknown, db = getStoreDatabase(), shopId = getStoreShopId()): Promise<ActivityWriteResult> {
  if (!db || !shopId) return { recorded: false };
  const rows = orderActivityRows(shopId, order);
  if (!rows) throw new Error("The order webhook payload could not be read.");
  if (rows.length) {
    const { error } = await db.from(table).upsert(rows, { onConflict: "shop_id,kind,source_key", ignoreDuplicates: true });
    if (error) throw new Error(`Recording order activity failed (${error.code ?? "unknown"}).`);
  }
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const { error } = await db.from(table).delete().eq("shop_id", shopId).lt("occurred_at", cutoff);
  if (error) throw new Error(`Pruning product activity failed (${error.code ?? "unknown"}).`);
  return { recorded: true };
}

/** Takes a cancelled order's sales back out of the totals. */
export async function forgetOrderActivity(order: unknown, db = getStoreDatabase(), shopId = getStoreShopId()): Promise<ActivityWriteResult> {
  if (!db || !shopId) return { recorded: false };
  const orderId = isRecord(order) ? idText(order.id) : null;
  if (!orderId) throw new Error("The order webhook payload could not be read.");
  const { error } = await db.from(table).delete().eq("shop_id", shopId).eq("kind", "sale").like("source_key", `order:${orderId}:%`);
  if (error) throw new Error(`Removing order activity failed (${error.code ?? "unknown"}).`);
  return { recorded: true };
}

/** The dedupe key for one cart and product. The cart ID itself never leaves the server. */
export function cartActivityKey(cartId: string, productId: string) {
  return `cart:${createHash("sha256").update(cartId).digest("hex").slice(0, 32)}:${productId}`;
}

/**
 * Notes that a cart added a product, once per cart and product. Best effort: a failure is
 * logged and swallowed, since the shopper's cart change already succeeded.
 */
export async function recordCartAdd(cartId: string, productGid: string, db = getStoreDatabase(), shopId = getStoreShopId()) {
  const productId = numericProductId(productGid);
  if (!db || !shopId || !productId) return;
  const row: ActivityRow = { shop_id: shopId, kind: "cart_add", product_id: productId, quantity: 1, source_key: cartActivityKey(cartId, productId), occurred_at: new Date().toISOString() };
  const { error } = await db.from(table).upsert([row], { onConflict: "shop_id,kind,source_key", ignoreDuplicates: true });
  if (error) console.error(`Recording a cart add failed (${error.code ?? "unknown"}).`);
}

type SummaryRow = {
  product_id: string; sold_30d: number | string; sold_7d: number | string; sold_prior_7d: number | string;
  sold_in_sale: number | string; carts_24h: number | string; carts_7d: number | string;
};

const count = (value: number | string) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

async function readSummary(db: SupabaseClient, shopId: string, saleStart: string | null): Promise<Record<string, ProductActivity>> {
  const { data, error } = await db.rpc("store_product_activity_summary", { p_shop_id: shopId, p_sale_start: saleStart }).abortSignal(AbortSignal.timeout(10_000));
  if (error) throw new Error(`Reading product activity failed (${error.code ?? "unknown"}).`);
  if (!Array.isArray(data)) throw new Error("Product activity came back in an unexpected shape.");
  return Object.fromEntries((data as SummaryRow[]).filter((row) => typeof row?.product_id === "string").map((row) => [row.product_id, {
    sold30: count(row.sold_30d), sold7: count(row.sold_7d), soldPrior7: count(row.sold_prior_7d),
    soldInSale: count(row.sold_in_sale), carts24h: count(row.carts_24h), carts7: count(row.carts_7d),
  }]));
}

/**
 * Activity per numeric Shopify product ID, cached for a few minutes, or null when the
 * store database isn't configured or the read fails (including before the migration lands).
 */
export async function getProductActivity(db = getStoreDatabase(), shopId = getStoreShopId()): Promise<Record<string, ProductActivity> | null> {
  if (!db || !shopId) return null;
  const saleStart = currentPromotion?.startsAt ? new Date(currentPromotion.startsAt).toISOString() : null;
  try {
    if (isLocalStoreDatabase()) return await readSummary(db, shopId, saleStart);
    return await unstable_cache(() => readSummary(db, shopId, saleStart), ["store-product-activity", shopId, saleStart ?? ""], { tags: [productActivityTag], revalidate: productActivityRevalidate })();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Reading product activity failed.");
    return null;
  }
}

/**
 * Labels every listing that earns one. Run after `withListingRatings`, since "Top rated"
 * reads the pooled rating; without activity, only rating and newness labels apply.
 */
export async function withListingHighlights<T extends { products: ProductListing[] } & Partial<CatalogSections>>(catalog: T): Promise<T> {
  return applyListingHighlights(catalog, await getProductActivity(), Date.now());
}

/** A product page's label and rounded milestone, each null when nothing has been earned. */
export async function getProductHighlight(listing: ProductListing): Promise<{ highlight: ListingHighlight | null; milestone: string | null }> {
  const [rated, activity] = await Promise.all([withListingRatings({ products: [listing] }), getProductActivity()]);
  const now = Date.now();
  return {
    highlight: applyListingHighlights(rated, activity, now).products[0]?.highlight ?? null,
    milestone: describeListingMilestone(activity && poolListingActivity(listing, activity), isPromotionLive(currentPromotion, now) ? currentPromotion.name : null),
  };
}
