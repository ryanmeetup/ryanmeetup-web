import { createHash } from "node:crypto";
const photoBytes = Buffer.from("UklGRkYAAABXRUJQVlA4IDoAAABQAwCdASowACAAPm02l0ikIyIhJWgAgA2JZwDQvoAAK/fDcAD+694v+rqMvyT//4ta3C0S8MmIgAAA", "base64");
// Transport double only; real database authorization/audit checks have their own suite.
export function createReviewModerationFixture(json, readBody, profile) {
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const initialTime = "2026-11-18T12:00:00.123456Z";
  let tick, reviews, calls, options;
  const revision = (n, rating, body) => ({ id: id(n + 100), rating, title: "Ryan approved", body, displayName: "Ryan Fixture", submittedAt: initialTime, photos: [] });
  function row(n, pending, published = null, state = "active") {
    return { reply: null, id: id(n), state, createdAt: `2026-11-18T12:00:${String(n).padStart(2, "0")}.123456Z`, updatedAt: initialTime,
      item: { productId: String(100 + n), productTitle: `Fixture shirt ${n}`, variantTitle: "Black / M" }, verifiedPurchase: n !== 1,
      pending, published, latest: pending ?? published ?? revision(n, 4, "Withdrawn text."), rejected: null,
      recentEvents: [{ action: "submitted", actorKind: "buyer", actor: null, note: null, createdAt: initialTime }] };
  }
  function reset(settings = {}) {
    options = settings; tick = 0; calls = [];
    profile.app_role = settings.role ?? "owner";
    reviews = settings.many ? Array.from({ length: 23 }, (_, i) => row(i + 1, revision(i + 1, 1, `Waiting review ${i + 1}.`))) : [
      row(1, revision(1, 1, "The size ran small.")),
      row(2, revision(2, 2, "Updated after washing."), revision(52, 5, "Original approved text.")),
      row(3, revision(3, 1, "A hidden edit."), revision(53, 3, "Hidden approved text."), "hidden"),
      row(4, null, null, "withdrawn"),
    ];
    if (settings.photos) reviews[0].pending.photos = [{ id: id(1001), width: 48, height: 32, state: "pending" }, { id: id(1002), width: 48, height: 32, state: "pending" }];
    if (settings.longText) {
      reviews[1].item.productTitle = "Ryan".repeat(50);
      reviews[1].pending.body = "review".repeat(150);
      reviews[1].pending.displayName = "Ryan".repeat(14);
    }
  }
  reset();
  const isOwner = () => profile.app_role === "owner";
  const waiting = (r) => r.state !== "withdrawn" && (r.pending || [r.pending,r.published].some((v) => v?.photos?.some((p) => p.state === "pending")));
  const inQueue = (command) => reviews.filter((r) => (!command.p_product_id || r.item.productId === command.p_product_id) && (command.p_filter === "all" ||
    (command.p_filter === "pending" && waiting(r)) ||
    (command.p_filter === "published" && r.published && r.state === "active") ||
    (command.p_filter === "hidden" && r.state === "hidden") ||
    (command.p_filter === "rejected" && r.rejected && r.state !== "withdrawn")));
  return async (request, response, url) => {
    if (url.pathname.startsWith("/storage/v1/object/store-review-photos/123/")) {
      if (request.headers.apikey !== "sb_secret_test") { json(response,403,{}); return true; }
      response.writeHead(200,{"Content-Type":"image/webp"}); response.end(photoBytes); return true;
    }
    if (url.pathname === "/__reviews/reset") { reset(await readBody(request)); json(response, 200, { ok: true }); return true; }
    if (url.pathname === "/__reviews/configure") { options = { ...options, ...await readBody(request) }; json(response, 200, { ok: true }); return true; }
    if (url.pathname === "/__reviews/state") { json(response, 200, { calls, reviews }); return true; }
    if (url.pathname === "/rest/v1/rpc/is_app_owner") { json(response, 200, isOwner()); return true; }
    if (url.pathname === "/rest/v1/store_review_revisions") {
      // The sidebar count: a service-role HEAD with an exact count, filtered to
      // pending revisions on this shop's unwithdrawn reviews.
      const p = url.searchParams;
      if (request.headers.apikey !== "sb_secret_test" || request.method !== "HEAD" || p.get("status") !== "eq.pending" ||
        p.get("review.shop_id") !== "eq.123" || p.get("review.state") !== "neq.withdrawn") {
        json(response, 400, { code: "PGRST100", message: "Unexpected count query" }); return true;
      }
      if (options.failCount) { json(response, 500, { code: "P0001", message: "Synthetic count failure" }); return true; }
      const count = reviews.filter((r) => r.pending && r.state !== "withdrawn").length;
      response.writeHead(200, { "content-range": count ? `0-${count - 1}/${count}` : `*/0`, "access-control-allow-origin": "*", "access-control-expose-headers": "*" });
      response.end(); return true;
    }
    if (!["/rest/v1/rpc/store_review_moderation_page_v5", "/rest/v1/rpc/store_review_moderation_products", "/rest/v1/rpc/store_moderate_review", "/rest/v1/rpc/store_save_review_reply", "/rest/v1/rpc/store_delete_review", "/rest/v1/rpc/store_staff_review_photo", "/rest/v1/rpc/store_moderate_review_photo", "/rest/v1/rpc/store_pending_review_count", "/rest/v1/rpc/store_review_moderation_count"].includes(url.pathname)) return false;
    const command = await readBody(request);
    if (!isOwner() || command.p_actor !== profile.id || command.p_shop_id !== "123" || request.headers.apikey !== "sb_secret_test") {
      json(response, 403, { code: "42501", message: "Owner required" }); return true;
    }
    if (url.pathname.endsWith("store_pending_review_count")) {
      if (options.failCount) json(response,500,{code:"P0001"}); else json(response,200,reviews.filter(waiting).length);
      return true;
    }
    if (url.pathname.endsWith("store_staff_review_photo")) {
      const r = reviews.find((entry) => entry.id === command.p_review_id);
      const v = r && [r.pending,r.published,r.rejected,r.latest].find((entry) => entry?.id === command.p_revision_id);
      const photo = v?.photos?.find((entry) => entry.id === command.p_photo_id);
      json(response,200,photo && r.updatedAt === command.p_expected_updated_at ? { id: photo.id, width: photo.width, height: photo.height,
        byteSize: photoBytes.length, sha256: createHash("sha256").update(photoBytes).digest("hex") } : null); return true;
    }
    if (url.pathname.endsWith("store_review_moderation_products")) {
      if (options.failRead) { json(response, 500, { code: "P0001", message: "Synthetic read failure" }); return true; }
      const products = new Map(reviews.map((r) => [r.item.productId, { productId: r.item.productId, productTitle: r.item.productTitle }]));
      json(response, 200, [...products.values()].sort((a, b) => a.productTitle.localeCompare(b.productTitle))); return true;
    }
    if (url.pathname.endsWith("store_review_moderation_count")) {
      if (options.failRead) { json(response, 500, { code: "P0001", message: "Synthetic read failure" }); return true; }
      json(response, 200, inQueue(command).length); return true;
    }
    if (url.pathname.endsWith("store_review_moderation_page_v5")) {
      if (options.failRead) { json(response, 500, { code: "P0001", message: "Synthetic read failure" }); return true; }
      const selected = inQueue(command);
      const after = command.p_after_created_at;
      json(response, 200, selected.filter((r) => !after || r.createdAt > after ||
        (r.createdAt === after && r.id > command.p_after_id)).slice(0, command.p_limit)); return true;
    }
    calls.push(command);
    const r = reviews.find((entry) => entry.id === command.p_review_id);
    // Publishing a version approves its undecided photos; rejected photos stay rejected.
    const approvePhotos = (v) => v.photos?.forEach((photo) => { if (photo.state === "pending") photo.state = "approved"; });
    const advance = () => `2026-11-18T12:01:00.${String(++tick).padStart(6, "0")}Z`;
    if (url.pathname.endsWith("store_delete_review")) {
      // Any state may be deleted; a stale view answers null. No fixture review has photos.
      if (options.conflictOnce && r) { options.conflictOnce = false; r.updatedAt = advance(); }
      if (!r || r.updatedAt !== command.p_expected_updated_at) { json(response, 200, null); return true; }
      reviews = reviews.filter((entry) => entry !== r);
      json(response, 200, []); return true;
    }
    if (url.pathname.endsWith("store_moderate_review_photo")) {
      if (options.conflictOnce && r) { options.conflictOnce = false; r.updatedAt = advance(); }
      const v = r && [r.pending,r.published,r.rejected,r.latest].find((entry) => entry?.id === command.p_revision_id);
      const photo = v?.photos?.find((entry) => entry.id === command.p_photo_id);
      if (!r || r.state === "withdrawn" || r.updatedAt !== command.p_expected_updated_at || !photo) { json(response,200,false); return true; }
      photo.state = command.p_action === "approve" ? "approved" : "rejected"; photo.rejectionReason = command.p_action === "reject" ? command.p_note : null; r.updatedAt = advance();
      r.recentEvents.unshift({action: command.p_action === "approve" ? "photo_approved" : "photo_rejected",actorKind:"staff",actor:profile.id,note:command.p_note,createdAt:r.updatedAt});
      json(response,200,true); return true;
    }
    const isReply = url.pathname.endsWith("store_save_review_reply");
    if (isReply && options.replyConflictOnce && r) {
      options.replyConflictOnce = false;
      r.reply = { body: "A newer staff reply.", publishedAt: initialTime, updatedAt: advance() }; r.updatedAt = r.reply.updatedAt;
      json(response, 200, false); return true;
    }
    if (options.conflictOnce && r) {
      options.conflictOnce = false;
      r.pending = revision(90, 2, "The buyer replaced this text."); r.latest = r.pending; r.rejected = null; r.updatedAt = advance();
      json(response, 200, false); return true;
    }
    if (!r || r.state === "withdrawn" || r.updatedAt !== command.p_expected_updated_at ||
      (["approve", "reject"].includes(command.p_action) && r.pending?.id !== command.p_revision_id) ||
      (command.p_action === "republish" && r.rejected?.id !== command.p_revision_id)) {
      json(response, 200, false); return true;
    }
    if (isReply) {
      if (!r.published || (r.reply?.body ?? null) === command.p_body) { json(response, 200, false); return true; }
      r.reply = command.p_body === null ? null : { body: command.p_body, publishedAt: r.reply?.publishedAt ?? advance(), updatedAt: advance() };
    }
    else if (command.p_action === "approve") { r.published = r.pending; r.pending = null; approvePhotos(r.published); }
    else if (command.p_action === "reject") { r.rejected = r.pending; r.pending = null; }
    else if (command.p_action === "republish") { r.published = r.rejected; r.rejected = null; approvePhotos(r.published); }
    else if (command.p_action === "hide") { r.state = "hidden"; }
    else if (command.p_action === "restore") { r.state = "active"; }
    r.updatedAt = advance();
    r.recentEvents.unshift({ action: isReply ? (command.p_body === null ? "reply_removed" : "reply_set") : { approve: "approved", reject: "rejected", hide: "hidden", restore: "restored", republish: "approved" }[command.p_action],
      actorKind: "staff", actor: profile.id, note: command.p_note ?? null, createdAt: r.updatedAt });
    if (options.failReadAfterSave) options.failRead = true;
    json(response, 200, true); return true;
  };
}
