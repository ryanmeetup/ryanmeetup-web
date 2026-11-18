// Transport double only; real database authorization/audit checks have their own suite.
export function createReviewModerationFixture(json, readBody, profile) {
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const initialTime = "2026-11-18T12:00:00.123456Z";
  let tick, reviews, calls, options;
  const revision = (n, rating, body) => ({ id: id(n + 100), rating, title: "Ryan approved", body, displayName: "Ryan Fixture", submittedAt: initialTime });
  function row(n, pending, published = null, state = "active") {
    return { reply: null, id: id(n), state, createdAt: `2026-11-18T12:00:${String(n).padStart(2, "0")}.123456Z`, updatedAt: initialTime,
      item: { productId: "100", productTitle: `Fixture shirt ${n}`, variantTitle: "Black / M" },
      pending, published, latest: pending ?? published ?? revision(n, 4, "Withdrawn text."),
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
    if (settings.longText) {
      reviews[1].item.productTitle = "Ryan".repeat(50);
      reviews[1].pending.body = "review".repeat(150);
      reviews[1].pending.displayName = "Ryan".repeat(14);
    }
  }
  reset();
  const isOwner = () => profile.app_role === "owner";
  return async (request, response, url) => {
    if (url.pathname === "/__reviews/reset") { reset(await readBody(request)); json(response, 200, { ok: true }); return true; }
    if (url.pathname === "/__reviews/configure") { options = { ...options, ...await readBody(request) }; json(response, 200, { ok: true }); return true; }
    if (url.pathname === "/__reviews/state") { json(response, 200, { calls, reviews }); return true; }
    if (url.pathname === "/rest/v1/rpc/is_app_owner") { json(response, 200, isOwner()); return true; }
    if (!["/rest/v1/rpc/store_review_moderation_page_v2", "/rest/v1/rpc/store_moderate_review", "/rest/v1/rpc/store_save_review_reply"].includes(url.pathname)) return false;
    const command = await readBody(request);
    if (!isOwner() || command.p_actor !== profile.id || command.p_shop_id !== "123" || request.headers.apikey !== "sb_secret_test") {
      json(response, 403, { code: "42501", message: "Owner required" }); return true;
    }
    if (url.pathname.endsWith("store_review_moderation_page_v2")) {
      if (options.failRead) { json(response, 500, { code: "P0001", message: "Synthetic read failure" }); return true; }
      const selected = reviews.filter((r) => command.p_filter === "all" ||
        (command.p_filter === "pending" && r.pending && r.state !== "withdrawn") ||
        (command.p_filter === "published" && r.published && r.state === "active") ||
        (command.p_filter === "hidden" && r.state === "hidden"));
      const after = command.p_after_created_at;
      json(response, 200, selected.filter((r) => !after || r.createdAt > after ||
        (r.createdAt === after && r.id > command.p_after_id)).slice(0, command.p_limit)); return true;
    }
    calls.push(command);
    const r = reviews.find((entry) => entry.id === command.p_review_id);
    const advance = () => `2026-11-18T12:01:00.${String(++tick).padStart(6, "0")}Z`;
    const isReply = url.pathname.endsWith("store_save_review_reply");
    if (isReply && options.replyConflictOnce && r) {
      options.replyConflictOnce = false;
      r.reply = { body: "A newer staff reply.", publishedAt: initialTime, updatedAt: advance() }; r.updatedAt = r.reply.updatedAt;
      json(response, 200, false); return true;
    }
    if (options.conflictOnce && r) {
      options.conflictOnce = false;
      r.pending = revision(90, 2, "The buyer replaced this text."); r.latest = r.pending; r.updatedAt = advance();
      json(response, 200, false); return true;
    }
    if (!r || r.state === "withdrawn" || r.updatedAt !== command.p_expected_updated_at ||
      (["approve", "reject"].includes(command.p_action) && r.pending?.id !== command.p_revision_id)) {
      json(response, 200, false); return true;
    }
    if (isReply) {
      if (!r.published || (r.reply?.body ?? null) === command.p_body) { json(response, 200, false); return true; }
      r.reply = command.p_body === null ? null : { body: command.p_body, publishedAt: r.reply?.publishedAt ?? advance(), updatedAt: advance() };
    }
    else if (command.p_action === "approve") { r.published = r.pending; r.pending = null; }
    else if (command.p_action === "reject") { r.pending = null; }
    else if (command.p_action === "hide") { r.state = "hidden"; }
    else if (command.p_action === "restore") { r.state = "active"; }
    r.updatedAt = advance();
    r.recentEvents.unshift({ action: isReply ? (command.p_body === null ? "reply_removed" : "reply_set") : { approve: "approved", reject: "rejected", hide: "hidden", restore: "restored" }[command.p_action],
      actorKind: "staff", actor: profile.id, note: command.p_note ?? null, createdAt: r.updatedAt });
    if (options.failReadAfterSave) options.failRead = true;
    json(response, 200, true); return true;
  };
}
