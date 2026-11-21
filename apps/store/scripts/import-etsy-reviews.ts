/**
 * Imports reviews from the Ryan Meetup Etsy shop into the store's own reviews.
 * Run from apps/store:
 *
 *   npx jiti scripts/import-etsy-reviews.ts <reviews.csv>            # dry run: prints the plan
 *   npx jiti scripts/import-etsy-reviews.ts <reviews.csv> --apply    # writes to RMT
 *
 * The CSV is the Judge.me-style Etsy export (title, body, rating, review_date,
 * reviewer_name, product_handle, reply, reply_date, picture_urls,
 * etsy_review_id, etsy_listing_title, etsy_listing_url, ...).
 *
 * Each review is published as left on Etsy, dated then, labelled "Verified
 * Etsy purchase", with its reply and photos. `etsy-review-products.json` maps
 * an Etsy listing to its Shopify product; an unmapped listing is stored under
 * its Etsy listing id and appears only in the shop-wide feed. Skipped: rows
 * with no text (a card with only stars has nothing to show) and rows whose
 * Etsy listing is gone (no product to name). Re-running skips reviews already
 * imported, so a failed run can simply be repeated.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { importedReviewContentSchema, reviewReplyBodySchema } from "@ryanmeetup/reviews";
import { prepareReviewPhoto } from "../lib/review-photo-processing";
import { createReviewPhotoStaging } from "../lib/review-photo-staging";
import { getStoreDatabase, getStoreShopId } from "../lib/store-database";

const root = path.resolve(__dirname, "..");
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  // Fall back to variables already in the environment.
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const csvPath = args.find((arg) => !arg.startsWith("--"));
if (!csvPath) {
  console.error("Usage: npx jiti scripts/import-etsy-reviews.ts <reviews.csv> [--apply]");
  process.exit(1);
}

const IMPORT_ACTOR = "Etsy import";
/** Etsy's placeholders for a buyer who closed their account or hid their name. */
const ANONYMOUS_ETSY_NAMES = new Set(["Inactive account", "Etsy buyer"]);
const ETSY_BUYER_NAME = "Etsy buyer";

/** RFC 4180: quoted fields may hold commas, doubled quotes and line breaks. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((cells) => cells.some(Boolean));
  return body.map((cells) => Object.fromEntries(header.map((name, index) => [name.replace(/^﻿/, ""), cells[index] ?? ""])));
}

/** A stable request key per photo, so a repeated run re-uses the same staged upload. */
function requestKey(...parts: string[]) {
  const hex = createHash("sha256").update(parts.join("\n")).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${"89ab"[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function shopifyProductIds(handles: string[]): Promise<Map<string, string>> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = process.env.SHOPIFY_STOREFRONT_API_TOKEN;
  if (!domain || !token) throw new Error("Set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_API_TOKEN (apps/store/.env.local).");
  const query = `{ ${handles.map((handle, index) => `p${index}: product(handle: ${JSON.stringify(handle)}) { id }`).join(" ")} }`;
  const response = await fetch(`https://${domain}/api/2026-04/graphql.json`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": token }, body: JSON.stringify({ query }),
  });
  const json = await response.json() as { data?: Record<string, { id: string } | null>; errors?: unknown };
  if (!response.ok || !json.data) throw new Error(`Shopify product lookup failed: ${JSON.stringify(json.errors ?? response.status)}`);
  const ids = new Map<string, string>();
  handles.forEach((handle, index) => {
    const id = json.data![`p${index}`]?.id.match(/^gid:\/\/shopify\/Product\/([1-9][0-9]{0,19})$/)?.[1];
    if (!id) throw new Error(`Mapped Shopify product "${handle}" is not on the storefront. Fix etsy-review-products.json.`);
    ids.set(handle, id);
  });
  return ids;
}

type Planned = {
  etsyId: string; productId: string; productTitle: string; storeHandle: string | null;
  rating: number; body: string; displayName: string; reviewedAt: string;
  reply: { body: string; at: string } | null; photoUrls: string[];
};

async function plan() {
  const rows = parseCsv(readFileSync(path.resolve(process.cwd(), csvPath!), "utf8"));
  const mapping = JSON.parse(readFileSync(path.join(__dirname, "etsy-review-products.json"), "utf8")) as Record<string, string>;
  delete mapping.$comment;
  const productIds = await shopifyProductIds([...new Set(Object.values(mapping))]);
  const planned: Planned[] = [];
  const skipped: { etsyId: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const etsyId = row.etsy_review_id;
    if (!/^[1-9][0-9]{0,19}$/.test(etsyId) || seen.has(etsyId)) throw new Error(`Missing or repeated Etsy review id: "${etsyId}"`);
    seen.add(etsyId);
    if (row.source !== "etsy") throw new Error(`Review ${etsyId} is not from Etsy`);
    const listingId = row.etsy_listing_url.match(/etsy\.com\/listing\/([1-9][0-9]{0,19})(?:\/|$)/)?.[1];
    if (!row.product_handle || !listingId || !row.etsy_listing_title.trim()) { skipped.push({ etsyId, reason: "Etsy listing is gone" }); continue; }
    const rawName = row.reviewer_name.trim();
    const content = importedReviewContentSchema({
      rating: Number(row.rating), body: row.body, displayName: ANONYMOUS_ETSY_NAMES.has(rawName) || !rawName ? ETSY_BUYER_NAME : rawName,
    });
    if (!row.body.trim()) { skipped.push({ etsyId, reason: "stars only, no text" }); continue; }
    if (!content) throw new Error(`Review ${etsyId} has text or a rating the store cannot publish`);
    if (row.title.trim()) throw new Error(`Review ${etsyId} has a title; this import expects Etsy's untitled reviews`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.review_date)) throw new Error(`Review ${etsyId} has no review date`);
    const reply = row.reply.trim() ? reviewReplyBodySchema(row.reply) : null;
    if (row.reply.trim() && (!reply || !/^\d{4}-\d{2}-\d{2}$/.test(row.reply_date))) throw new Error(`Review ${etsyId} has an unusable reply`);
    const photoUrls = row.picture_urls.split(",").map((url) => url.trim()).filter(Boolean);
    for (const url of photoUrls) if (new URL(url).hostname !== "i.etsystatic.com") throw new Error(`Review ${etsyId} has a photo off Etsy: ${url}`);
    if (photoUrls.length > 5) throw new Error(`Review ${etsyId} has more than five photos`);
    const storeHandle = mapping[row.product_handle] ?? null;
    planned.push({
      etsyId, storeHandle, productId: storeHandle ? productIds.get(storeHandle)! : listingId,
      productTitle: row.etsy_listing_title.trim().slice(0, 255),
      rating: content.rating, body: content.body, displayName: content.displayName,
      reviewedAt: `${row.review_date}T00:00:00.000Z`,
      reply: reply ? { body: reply, at: `${row.reply_date}T00:00:00.000Z` } : null, photoUrls,
    });
  }
  return { rows, planned, skipped };
}

async function main() {
  const { rows, planned, skipped } = await plan();
  const onStore = planned.filter((review) => review.storeHandle);
  console.log(`${rows.length} Etsy reviews: ${planned.length} to import, ${skipped.length} skipped.`);
  console.log(`  ${onStore.length} on a store product page, ${planned.length - onStore.length} in the shop-wide feed only.`);
  console.log(`  ${planned.reduce((sum, review) => sum + review.photoUrls.length, 0)} photos, ${planned.filter((review) => review.reply).length} replies.`);
  const byProduct = new Map<string, number>();
  for (const review of onStore) byProduct.set(review.storeHandle!, (byProduct.get(review.storeHandle!) ?? 0) + 1);
  console.log("\nOn store products:");
  for (const [handle, count] of [...byProduct].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${handle}`);
  const feedOnly = new Map<string, number>();
  for (const review of planned.filter((entry) => !entry.storeHandle)) feedOnly.set(review.productTitle, (feedOnly.get(review.productTitle) ?? 0) + 1);
  console.log("\nFeed only (Etsy listing title):");
  for (const [title, count] of [...feedOnly].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${title}`);
  console.log("\nSkipped:");
  for (const { etsyId, reason } of skipped) console.log(`  ${etsyId}  ${reason}`);

  if (!apply) {
    console.log("\nDry run. Pass --apply to write these reviews to RMT.");
    return;
  }
  const database = getStoreDatabase();
  const shopId = getStoreShopId();
  if (!database || !shopId) throw new Error("Set SUPABASE_URL (RMT), SUPABASE_SECRET_KEY and SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID in apps/store/.env.local.");
  const staging = createReviewPhotoStaging({ database, shopId });

  const existing = await database.from("store_reviews").select("source_review_id")
    .eq("shop_id", shopId).eq("source", "etsy").in("source_review_id", planned.map((review) => review.etsyId));
  if (existing.error) throw new Error(`Could not read imported reviews: ${existing.error.message}`);
  const done = new Set(existing.data.map((row) => row.source_review_id as string));
  let created = 0;
  for (const review of planned) {
    if (done.has(review.etsyId)) continue;
    const subject = `etsy:${review.etsyId}`;
    const photoIds: string[] = [];
    for (const url of review.photoUrls) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Photo for review ${review.etsyId} did not download (${response.status}): ${url}`);
      const prepared = await prepareReviewPhoto(new Uint8Array(await response.arrayBuffer()), response.headers.get("content-type") ?? "");
      if (!prepared.ok) throw new Error(`Photo for review ${review.etsyId} was refused (${prepared.reason}): ${url}`);
      const staged = await staging.stage({ subject, productId: review.productId, requestKey: requestKey(review.etsyId, url), photo: prepared.photo });
      if (staged.status !== "ready") throw new Error(`Photo for review ${review.etsyId} could not be staged (${staged.status})`);
      photoIds.push(staged.photo.id);
    }
    const result = await database.rpc("store_import_etsy_review", {
      p_shop_id: shopId, p_etsy_review_id: review.etsyId, p_product_id: review.productId, p_product_title: review.productTitle,
      p_rating: review.rating, p_body: review.body, p_display_name: review.displayName, p_reviewed_at: review.reviewedAt,
      p_reply_body: review.reply?.body ?? null, p_reply_at: review.reply?.at ?? null, p_photo_ids: photoIds, p_actor: IMPORT_ACTOR,
    });
    if (result.error) throw new Error(`Review ${review.etsyId} failed to import: ${result.error.message}`);
    created += 1;
  }
  console.log(`\nImported ${created} reviews; ${done.size} were already there.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
