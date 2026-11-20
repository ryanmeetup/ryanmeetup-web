import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { createReviewPhotoStaging, ReviewPhotoStagingError } from "../lib/review-photo-staging";
import { prepareReviewPhoto } from "../lib/review-photo-processing";
import type { PreparedReviewPhoto } from "../lib/review-photo-processing";
import { fakeSupabase, supabaseCall } from "./fixtures/customer-auth-backend";

const requestKey = "00000000-0000-4000-8000-000000000001";
const scope = { subject: "private-buyer", productId: "100" };
let photo: PreparedReviewPhoto;
test.beforeAll(async () => {
  const prepared = await prepareReviewPhoto(await sharp({ create: { width: 48, height: 32, channels: 3, background: "red" } }).png().toBuffer());
  if (!prepared.ok) throw new Error("Could not prepare synthetic photo");
  photo = prepared.photo;
});

function fixture() {
  type Row = { id: string; productId: string; sha256: string; byteSize: number; width: number; height: number; state: string; expiresAt: string };
  const rows = new Map<string, { owner: string; key: string; photo: Row }>();
  const objects = new Map<string, Buffer>();
  const calls: { name: string; args?: Record<string, unknown>; path?: string; headers?: Headers }[] = [];
  const state = { upload: "ok", finish: "ok", discard: "ok", remove: "ok", beginReply: undefined as unknown, full: false, close: false };
  const database = fakeSupabase(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const call = supabaseCall(input, init)!; calls.push(call);
      const a = call.args;
      const owner = JSON.stringify([a.p_shop_id, a.p_subject, a.p_product_id]);
      if (call.name === "store_begin_review_photo") {
        if (state.beginReply !== undefined) return Response.json(state.beginReply);
        if (state.full) return Response.json({ outcome: "full", photo: null });
        let row = [...rows.values()].find((row) => row.owner === owner && row.key === a.p_request_key);
        if (row && (row.photo.sha256 !== a.p_sha256 || row.photo.byteSize !== a.p_byte_size || row.photo.width !== a.p_width || row.photo.height !== a.p_height)) return Response.json({ outcome: "conflict", photo: null });
        if (row?.photo.state === "discarded") return Response.json({ outcome: "closed", photo: null });
        const outcome = row ? "exists" : "allocated";
        if (!row) {
          const id = `00000000-0000-4000-8000-${String(rows.size + 10).padStart(12, "0")}`;
          row = { owner, key: String(a.p_request_key), photo: { id, productId: String(a.p_product_id), sha256: String(a.p_sha256), byteSize: Number(a.p_byte_size), width: Number(a.p_width), height: Number(a.p_height), state: "uploading", expiresAt: new Date(Date.now() + 3600_000).toISOString() } };
          rows.set(id, row);
        }
        return Response.json({ outcome, photo: row.photo });
      }
      const row = rows.get(String(a.p_id).toLowerCase());
      const owned = row?.owner === owner;
      if (call.name === "store_get_review_photo") return Response.json(owned && row.photo.state !== "discarded" ? row.photo : null);
      if (call.name === "store_finish_review_photo") {
        if (!owned || row.photo.state === "discarded" || row.photo.sha256 !== a.p_sha256 || state.close) return Response.json(false);
        row.photo.state = "ready";
        if (state.finish === "lost") { state.finish = "ok"; throw new Error("private lost database response"); }
        return Response.json(true);
      }
      if (call.name === "store_discard_review_photo") {
        if (!owned) return Response.json(false);
        row.photo.state = "discarded";
        if (state.discard === "lost") { state.discard = "ok"; throw new Error("private lost discard response"); }
        return Response.json(true);
      }
      throw new Error("Unexpected synthetic RPC");
    }
    const prefix = "/storage/v1/object/";
    const path = url.pathname.slice(prefix.length).replace(/^authenticated\//, "");
    calls.push({ name: `storage.${init?.method ?? "GET"}`, path, headers: new Headers(init?.headers) });
    if (init?.method === "POST") {
      const bytes = Buffer.from(init.body as Uint8Array);
      if (state.upload === "unavailable") { state.upload = "ok"; return Response.json({ message: "private unavailable" }, { status: 503 }); }
      if (objects.has(path)) return Response.json({ message: "Already exists" }, { status: 409 });
      objects.set(path, state.upload === "mismatch" ? Buffer.alloc(bytes.length, 1) : Buffer.from(bytes));
      if (state.upload === "lost") { state.upload = "ok"; throw new Error("private lost upload response"); }
      if (state.upload === "mismatch") return Response.json({ message: "private failure" }, { status: 500 });
      return Response.json({ Key: path });
    }
    if (init?.method === "DELETE") {
      if (state.remove === "unavailable") { state.remove = "ok"; return Response.json({ message: "private remove failure" }, { status: 503 }); }
      const paths = (JSON.parse(String(init.body)) as { prefixes: string[] }).prefixes;
      paths.forEach((name) => objects.delete(`${path}/${name}`));
      return Response.json(paths.map((name) => ({ name })));
    }
    const bytes = objects.get(path);
    return bytes ? new Response(new Uint8Array(bytes), { headers: { "content-type": "image/webp" } }) : Response.json({ message: "not found" }, { status: 404 });
  });
  const backend = createReviewPhotoStaging({ database, shopId: "123" });
  return { backend, rows, objects, calls, state, stage: () => backend.stage({ ...scope, requestKey, photo }) };
}

test("only prepared bytes enter the fixed private bucket and only draft references are returned", async () => {
  const f = fixture(); const result = await f.stage();
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error("Expected ready fixture");
  expect(Object.keys(result.photo).sort()).toEqual(["expiresAt", "height", "id", "width"]);
  expect(f.objects.get(`store-review-photos/123/${result.photo.id}.webp`)).toEqual(photo.bytes);
  expect(f.calls.filter((call) => !call.name.startsWith("storage.")).map((call) => call.name)).toEqual(["store_begin_review_photo", "store_finish_review_photo"]);
  expect(f.calls[0].args).toMatchObject({ p_shop_id: "123", p_subject: scope.subject, p_product_id: "100", p_request_key: requestKey, p_byte_size: photo.bytes.length, p_width: 48, p_height: 32 });
  const upload = f.calls.find((call) => call.name === "storage.POST")!;
  expect(upload.headers!.get("x-upsert")).toBe("false");
  expect(upload.headers!.get("content-type")).toBe("image/webp");
  expect(upload.headers!.get("cache-control")).toBe("max-age=0");
  expect(JSON.stringify(result)).not.toMatch(/private-buyer|sha256|store-review-photos|signed|url/i);
});

test("ready retries reuse their slot without overwriting or creating another object", async () => {
  const f = fixture(); const first = await f.stage();
  expect(await f.stage()).toEqual(first);
  expect(f.rows.size).toBe(1); expect(f.objects.size).toBe(1);
  expect(f.calls.filter((call) => call.name === "storage.POST")).toHaveLength(1);
  expect(await f.backend.stage({ ...scope, requestKey, photo: { ...photo, bytes: Buffer.concat([photo.bytes, Buffer.from("different")]) } })).toEqual({ status: "conflict" });
});

test("a lost upload response is recovered only by verifying the stored bytes against the exact digest", async () => {
  const f = fixture(); f.state.upload = "lost";
  expect((await f.stage()).status).toBe("ready");
  expect(f.calls.some((call) => call.name === "storage.GET")).toBe(true);
  const corrupt = fixture(); corrupt.state.upload = "mismatch";
  await expect(corrupt.stage()).rejects.toThrow(ReviewPhotoStagingError);
  expect(corrupt.calls.some((call) => call.name === "store_finish_review_photo")).toBe(false);
  expect(corrupt.calls.some((call) => call.name === "storage.DELETE")).toBe(false);
});

test("an unavailable upload retains the private slot so the same key can resume", async () => {
  const f = fixture(); f.state.upload = "unavailable";
  await expect(f.stage()).rejects.toThrow("Review photo storage is temporarily unavailable.");
  expect(f.rows.size).toBe(1); expect(f.objects.size).toBe(0);
  expect((await f.stage()).status).toBe("ready");
  expect(f.rows.size).toBe(1); expect(f.objects.size).toBe(1);
});

test("an uncertain finalization never deletes the object; the same key recovers the confirmed state", async () => {
  const f = fixture(); f.state.finish = "lost";
  await expect(f.stage()).rejects.toThrow(ReviewPhotoStagingError);
  expect(f.objects.size).toBe(1);
  expect((await f.stage()).status).toBe("ready");
  expect(f.calls.filter((call) => call.name === "storage.POST")).toHaveLength(1);
  expect(f.calls.some((call) => call.name === "storage.DELETE")).toBe(false);
});

test("only an owned buyer/product draft can be read or discarded", async () => {
  const f = fixture(); const result = await f.stage();
  if (result.status !== "ready") throw new Error("Expected ready fixture");
  expect(await f.backend.getReady({ ...scope, id: result.photo.id })).toEqual(result.photo);
  for (const forged of [{ ...scope, subject: "other-buyer" }, { ...scope, productId: "999" }]) {
    expect(await f.backend.getReady({ ...forged, id: result.photo.id })).toBeNull();
    expect(await f.backend.discard({ ...forged, id: result.photo.id })).toBe(false);
  }
  expect(f.objects.size).toBe(1);
  expect(f.calls.some((call) => call.name === "storage.DELETE")).toBe(false);
  expect(await f.backend.discard({ ...scope, id: result.photo.id.toUpperCase() })).toBe(true);
  expect(f.objects.size).toBe(0);
  expect(await f.backend.getReady({ ...scope, id: result.photo.id })).toBeNull();
});

test("uncertain discard and failed object removal remain safe to retry without reviving the slot", async () => {
  for (const failure of ["discard", "remove"] as const) {
    const f = fixture(); const result = await f.stage();
    if (result.status !== "ready") throw new Error("Expected ready fixture");
    f.state[failure] = failure === "discard" ? "lost" : "unavailable";
    await expect(f.backend.discard({ ...scope, id: result.photo.id })).rejects.toThrow(ReviewPhotoStagingError);
    expect(f.objects.size).toBe(1);
    expect(await f.stage()).toEqual({ status: "closed" });
    expect(await f.backend.discard({ ...scope, id: result.photo.id })).toBe(true);
    expect(f.objects.size).toBe(0);
  }
});

test("full quota and expiry/discard during upload cannot return a ready reference", async () => {
  const full = fixture(); full.state.full = true;
  expect(await full.stage()).toEqual({ status: "full" });
  expect(full.calls.some((call) => call.name.startsWith("storage."))).toBe(false);
  const closed = fixture(); closed.state.close = true;
  expect(await closed.stage()).toEqual({ status: "closed" });
  expect(closed.objects.size).toBe(1); // Private, awaiting cleanup, never a published object.
});

test("unsafe identifiers and malformed storage responses fail before a storage write", async () => {
  const f = fixture();
  for (const input of [{ ...scope, requestKey: "../object" }, { ...scope, productId: "../100", requestKey }, { ...scope, subject: "", requestKey }]) {
    await expect(f.backend.stage({ ...input, photo })).rejects.toThrow(ReviewPhotoStagingError);
  }
  expect(f.calls).toEqual([]);
  for (const value of [{ outcome: "allocated", photo: { id: "../private" } }, { outcome: "full", photo: { privateSubject: "secret" } }, { outcome: "full", photo: null, privateSubject: "secret" }]) {
    const broken = fixture(); broken.state.beginReply = value;
    await expect(broken.stage()).rejects.toThrow("Review photo storage is temporarily unavailable.");
    expect(broken.calls.some((call) => call.name.startsWith("storage."))).toBe(false);
  }
});

test("a prepared buffer is copied before asynchronous staging work", async () => {
  const f = fixture(); const bytes = Buffer.from(photo.bytes);
  const pending = f.backend.stage({ ...scope, requestKey, photo: { ...photo, bytes } });
  bytes.fill(0);
  expect((await pending).status).toBe("ready");
  expect([...f.objects.values()][0]).toEqual(photo.bytes);
});

test("the upload budget pins the shop and rejects malformed or leaky responses", async () => {
  let response: unknown = { allowed: true, retryAfter: 0 };
  const calls: unknown[] = [];
  const database = fakeSupabase(async (input, init) => { calls.push(supabaseCall(input, init)); return Response.json(response); });
  const staging = createReviewPhotoStaging({ database, shopId: "123" });
  expect(await staging.consumeUploadBudget("private-buyer")).toEqual(response);
  expect(calls).toEqual([{ name: "store_consume_review_photo_budget", args: { p_shop_id: "123", p_subject: "private-buyer" } }]);
  response = { allowed: false, retryAfter: 600 }; expect(await staging.consumeUploadBudget("private-buyer")).toEqual(response);
  for (response of [null, {}, { allowed: true, retryAfter: 3 }, { allowed: false, retryAfter: 0 }, { allowed: false, retryAfter: 601 }, { allowed: true, retryAfter: 0, subject: "secret" }]) {
    await expect(staging.consumeUploadBudget("private-buyer")).rejects.toThrow(ReviewPhotoStagingError);
  }
});
