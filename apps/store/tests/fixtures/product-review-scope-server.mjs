import { createHash } from "node:crypto";
const photoBytes = Buffer.from("UklGRkYAAABXRUJQVlA4IDoAAABQAwCdASowACAAPm02l0ikIyIhJWgAgA2JZwDQvoAAK/fDcAD+694v+rqMvyT//4ta3C0S8MmIgAAA", "base64");
// Isolated public-read fixture. No buyer sessions, writes, Shopify or Supabase calls.
import { createServer } from "node:http";

const port = Number(process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369);
let products = {};
let privateOperationAttempts = 0;
const json = (response, status, value) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
};

createServer(async (request, response) => {
  try {
    if (request.url === "/health") return json(response, 200, { ok: true });
    if (request.url === "/__state") return json(response, 200, { privateOperationAttempts });
    if (request.url.startsWith("/storage/v1/object/store-review-photos/123456/")) {
      response.writeHead(200,{"Content-Type":"image/webp"});response.end(photoBytes);return;
    }
    let text = "";
    for await (const chunk of request) text += chunk;
    const input = JSON.parse(text || "{}");
    if (request.url === "/__configure") {
      products = input;
      privateOperationAttempts = 0;
      return json(response, 200, { ok: true });
    }
    if (request.url === "/rest/v1/rpc/store_public_review_photo") {
      const path = `/api/reviews/media/${input.p_review_id}/${input.p_revision_id}/${input.p_photo_id}`;
      const photo = Object.values(products).flatMap((p) => p.reviews ?? []).filter((r) => r.id === input.p_review_id).flatMap((r) => r.photos).find((p) => p.url === path);
      return json(response,200,photo ? {id:input.p_photo_id,width:photo.width,height:photo.height,byteSize:photoBytes.length,sha256:createHash("sha256").update(photoBytes).digest("hex")} : null);
    }
    if (!["/rest/v1/rpc/store_latest_reviews", "/rest/v1/rpc/store_review_summary", "/rest/v1/rpc/store_public_reviews"].includes(request.url)) {
      privateOperationAttempts += 1;
      return json(response, 404, { message: "Only public review reads are supported" });
    }
    if (request.headers.apikey !== "synthetic-supabase-secret" || input.p_shop_id !== "123456") {
      return json(response, 401, { message: "Synthetic public-read credentials required" });
    }
    if (request.url === "/rest/v1/rpc/store_latest_reviews") {
      if (Object.values(products).some((product) => product.unavailable)) return json(response, 503, { message: "Synthetic review outage" });
      return json(response, 200, Object.values(products).flatMap((product) => product.reviews ?? [])
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.id.localeCompare(a.id)).slice(0, 6));
    }
    const product = products[input.p_product_ids?.[0]];
    if (!product || product.unavailable) return json(response, 503, { message: "Synthetic review outage" });
    if (request.url === "/rest/v1/rpc/store_review_summary") return json(response, 200, product.summary);
    if (request.url === "/rest/v1/rpc/store_public_reviews") {
      const rows = [...product.reviews].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.id.localeCompare(a.id));
      const after = input.p_after_published_at;
      return json(response, 200, rows.filter((row) => !after || Date.parse(row.publishedAt) < Date.parse(after) ||
        (Date.parse(row.publishedAt) === Date.parse(after) && row.id < input.p_after_id)).slice(0, input.p_limit));
    }
  } catch {
    return json(response, 400, { message: "Invalid synthetic request" });
  }
}).listen(port, "127.0.0.1");
