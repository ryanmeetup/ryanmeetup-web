import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { copyScopedMigrationSources, migrationTarget } from "./migration-plan.mjs";

// Reset only a separately named Supabase stack on separate ports.
// The CLI treats a loopback --db-url as the default local stack, ignoring its
// database name, so a second database in the app container is NOT isolation.
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const { values } = parseArgs({ options: { target: { type: "string", default: "rmt" } } });
const target = migrationTarget(values.target);
const projectId = `store-auth-test-${randomBytes(6).toString("hex")}`;
const testRoot = mkdtempSync(join(tmpdir(), "store-customer-auth-"));
const container = `supabase_db_${projectId}`;
const database = "postgres";
const migration = fileURLToPath(new URL("../supabase/migrations/20261120130000_store_customer_auth_storage.sql", import.meta.url));
const reviewsMigration = fileURLToPath(new URL("../supabase/migrations/20261120140000_store_reviews.sql", import.meta.url));
const buyerReviewsMigration = fileURLToPath(new URL("../supabase/migrations/20261120180000_store_buyer_reviews.sql", import.meta.url));
const buyerSessionsMigration = fileURLToPath(new URL("../supabase/migrations/20261120190000_store_customer_session_revoke_buyer.sql", import.meta.url));
// Replayed last: it redefines functions the earlier replays restore.
const unverifiedReviewsMigration = fileURLToPath(new URL("../supabase/migrations/20261120210000_store_unverified_reviews.sql", import.meta.url));
const photoStagingMigration = fileURLToPath(new URL("../supabase/migrations/20261120220000_store_review_photo_staging.sql", import.meta.url));
const photoAttachmentsMigration = fileURLToPath(new URL("../supabase/migrations/20261120230000_store_review_photo_attachments.sql", import.meta.url));

const photoReadsMigration = fileURLToPath(new URL("../supabase/migrations/20261121000000_store_review_photo_reads.sql", import.meta.url));
const rejectedQueueMigration = fileURLToPath(new URL("../supabase/migrations/20261121010000_store_review_rejected_queue.sql", import.meta.url));
const deletionsMigration = fileURLToPath(new URL("../supabase/migrations/20261121020000_store_review_deletions.sql", import.meta.url));

const photoPublicationMigration = fileURLToPath(new URL("../supabase/migrations/20261121030000_store_review_photo_publication.sql", import.meta.url));
const buyerRejectionReasonMigration = fileURLToPath(new URL("../supabase/migrations/20261121040000_store_review_buyer_rejection_reason.sql", import.meta.url));
const latestReviewsMigration = fileURLToPath(new URL("../supabase/migrations/20261121050000_store_latest_reviews.sql", import.meta.url));
const writeBudgetsMigration = fileURLToPath(new URL("../supabase/migrations/20261121120000_store_review_write_budgets.sql", import.meta.url));
const approvalIncludesPhotosMigration = fileURLToPath(new URL("../supabase/migrations/20261121130000_store_review_approval_includes_photos.sql", import.meta.url));
const reviewFeedMigration = fileURLToPath(new URL("../supabase/migrations/20261121060000_store_review_feed.sql", import.meta.url));
const halfStarRatingsMigration = fileURLToPath(new URL("../supabase/migrations/20261121140000_store_review_half_star_ratings.sql", import.meta.url));
const etsyImportMigration = fileURLToPath(new URL("../supabase/migrations/20261121150000_store_etsy_review_import.sql", import.meta.url));
const reviewSearchMigration = fileURLToPath(new URL("../supabase/migrations/20261121160000_store_review_search_pages.sql", import.meta.url));
const cleanupMigration = fileURLToPath(new URL("../supabase/migrations/20261121180000_store_review_cleanup.sql", import.meta.url));
const moderationNewestFirstMigration = fileURLToPath(new URL("../supabase/migrations/20261123010000_store_review_moderation_newest_first.sql", import.meta.url));
const photoRejectionReasonsMigration = fileURLToPath(new URL("../supabase/migrations/20261121070000_store_review_photo_rejection_reasons.sql", import.meta.url));

function run(command, args, input, inherit = false) {
  const result = spawnSync(command, args, { cwd: appRoot, input, encoding: "utf8", stdio: inherit ? "inherit" : undefined, maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed (${result.status})`);
  return result.stdout?.trim();
}

const portFree = (port) => new Promise((resolve) => {
  const server = createServer();
  server.once("error", () => resolve(false));
  server.listen(port, "0.0.0.0", () => server.close(() => resolve(true)));
});

// Below 32768, outside the Linux (32768-60999) and macOS (49152-65535) ephemeral
// ranges, so an outbound connection (e.g. image pulls) cannot already hold the
// port when Docker binds it. Random so concurrent local runs do not collide.
async function freePortBlock() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const base = 20000 + Math.floor(Math.random() * 1200) * 10;
    const ports = [base, base + 1, base + 2];
    if ((await Promise.all(ports.map(portFree))).every(Boolean)) return ports;
  }
  throw new Error("No free port block for the isolated Supabase stack");
}

const sql = (text, target = database) => run("docker", ["exec", "-i", container, "psql", "-U", "supabase_admin", "-XAt", "-v", "ON_ERROR_STOP=1", "-d", target], text);

function connection(name) {
  const child = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=${name}`, container, "psql", "-U", "supabase_admin", "-XAt", "-v", "ON_ERROR_STOP=1", "-d", database]);
  let stdout = "";
  let stderr = "";
  let ready;
  const locked = new Promise((resolve) => { ready = resolve; });
  child.stdout.on("data", (chunk) => { stdout += chunk; if (stdout.includes("store-test-locked")) ready(); });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  return { child, locked, exited };
}

async function race(first, second) {
  const left = connection("store-auth-race-a");
  left.child.stdin.write(`begin; set local role service_role; ${first};\n\\echo store-test-locked\n`);
  await Promise.race([left.locked, left.exited.then((result) => { throw new Error(result.stderr || "First writer failed to lock"); })]);
  const right = connection("store-auth-race-b");
  right.child.stdin.end(`set role service_role; ${second};\n`);
  try {
    const deadline = Date.now() + 5000;
    while (sql("select exists(select 1 from pg_stat_activity where application_name='store-auth-race-b' and wait_event_type='Lock')") !== "t") {
      if (Date.now() > deadline) throw new Error("Second writer did not wait for the row lock");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    left.child.stdin.end("commit;\n");
  }
  const results = await Promise.all([left.exited, right.exited]);
  for (const result of results) if (result.code !== 0) throw new Error(result.stderr || "Concurrent writer failed");
  const booleans = results.map((result) => result.stdout.split(/\r?\n/).filter((line) => line === "t" || line === "f").join(""));
  if (booleans[0] !== "t" || booleans[1] !== "f") throw new Error(`Expected one winner and one rejection: ${booleans}`);
}

try {
  const selected = copyScopedMigrationSources(join(testRoot, "supabase"), target);
  const configPath = join(testRoot, "supabase/config.toml");
  const [shadowPort, apiPort, dbPort] = await freePortBlock();
  const config = readFileSync(configPath, "utf8")
    .replace('project_id = "ryanmeetup-tasks"', `project_id = "${projectId}"`)
    .replace("shadow_port = 54320", `shadow_port = ${shadowPort}`)
    .replace(/^port = 54321$/m, `port = ${apiPort}`)
    .replace(/^port = 54322$/m, `port = ${dbPort}`);
  if (!config.startsWith(`project_id = "${projectId}"`) || projectId === "ryanmeetup-tasks") throw new Error("Refusing to use the app's Supabase project");
  if (/\b5432[0-2]\b/.test(config)) throw new Error("Isolated stack still uses the app's default ports");
  writeFileSync(configPath, config);
  run("supabase", ["start", "--workdir", testRoot, "--exclude", "realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"], undefined, true);
  run("supabase", ["db", "reset", "--local", "--no-seed", "--yes", "--workdir", testRoot], undefined, true);
  const applied = sql("select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations");
  if (applied !== selected.map(({ version }) => version).join(",")) throw new Error("Reset history does not match the selected migration profile");
  if (target === "prd") {
    const privateObjectsAbsent = sql("select to_regclass('public.store_customer_authorizations') is null and to_regclass('public.store_customer_sessions') is null and to_regclass('public.store_reviews') is null and not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'store_%review%') and not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in ('store_get_customer_authorization','store_consume_customer_authorization','store_get_customer_session','store_rotate_customer_session','store_revoke_customer_session','store_revoke_customer_buyer_sessions'))");
    if (privateObjectsAbsent !== "t") throw new Error("RMT-only store objects leaked into the PRD profile");
    if (sql("select to_regclass('public.store_review_suggestion_dismissals') is null and to_regclass('public.store_review_photo_drafts') is null and to_regclass('public.store_review_revision_photos') is null and to_regclass('public.store_review_photo_budgets') is null and to_regclass('public.store_review_write_budgets') is null and not exists(select 1 from storage.buckets where id='store-review-photos')") !== "t") throw new Error("Photo staging leaked into PRD");
    run("supabase", ["test", "db", "--workdir", testRoot, join(appRoot, "supabase/tests/access_control.sql"), join(appRoot, "tests/database/guest-access.sql")], undefined, true);
    console.log("PASS: PRD profile resets and supports Tasks without store auth objects or synthetic history");
  } else {
    sql(readFileSync(migration, "utf8"));
    sql(readFileSync(reviewsMigration, "utf8"));
    sql(readFileSync(buyerReviewsMigration, "utf8"));
    sql(readFileSync(buyerSessionsMigration, "utf8"));
    sql(readFileSync(unverifiedReviewsMigration, "utf8"));
    sql(readFileSync(photoStagingMigration, "utf8"));
    sql(readFileSync(photoAttachmentsMigration, "utf8"));
    sql(readFileSync(photoReadsMigration, "utf8"));
    sql(readFileSync(rejectedQueueMigration, "utf8"));
    sql(readFileSync(deletionsMigration, "utf8"));
    sql(readFileSync(photoPublicationMigration, "utf8"));
    sql(readFileSync(buyerRejectionReasonMigration, "utf8"));
    sql(readFileSync(latestReviewsMigration, "utf8"));
    sql(readFileSync(reviewFeedMigration, "utf8"));
    sql(readFileSync(photoRejectionReasonsMigration, "utf8"));
    sql(readFileSync(writeBudgetsMigration, "utf8"));
    sql(readFileSync(approvalIncludesPhotosMigration, "utf8"));
    // Last again: earlier replays restore the smallint rating overloads it drops.
    sql(readFileSync(halfStarRatingsMigration, "utf8"));
    // After the photo publication replay, which restores the projections without `source`.
    sql(readFileSync(etsyImportMigration, "utf8"));
    // After the Etsy replay, which restores store_public_reviews with its own projection.
    sql(readFileSync(reviewSearchMigration, "utf8"));
    sql(readFileSync(cleanupMigration, "utf8"));
    // After the Etsy replay, which restores the oldest-first moderation queue.
    sql(readFileSync(moderationNewestFirstMigration, "utf8"));
    console.log("PASS: full migration reset and idempotent auth and review migration replay");
    run("supabase", ["test", "db", "--workdir", testRoot, join(appRoot, "tests/database/store-customer-auth.sql"), join(appRoot, "tests/database/store-reviews.sql"), join(appRoot, "tests/database/store-buyer-reviews.sql"), join(appRoot, "tests/database/store-review-photo-staging.sql"), join(appRoot, "tests/database/store-review-photo-attachments.sql"), join(appRoot, "tests/database/store-review-photo-reads.sql"), join(appRoot, "tests/database/store-review-deletions.sql"), join(appRoot, "tests/database/store-review-photo-publication.sql"), join(appRoot, "tests/database/store-latest-reviews.sql"), join(appRoot, "tests/database/store-review-feed.sql"), join(appRoot, "tests/database/store-review-write-budgets.sql"), join(appRoot, "tests/database/store-review-half-stars.sql"), join(appRoot, "tests/database/store-etsy-reviews.sql"), join(appRoot, "tests/database/store-review-search.sql"), join(appRoot, "tests/database/store-review-cleanup.sql"), join(appRoot, "tests/database/store-review-suggestion-dismissals.sql"), join(appRoot, "supabase/tests/access_control.sql")], undefined, true);
    const integration = spawnSync("npx", ["playwright", "test", "tests/customer-account-storage.spec.ts", "--workers=1"], {
      cwd: fileURLToPath(new URL("../../store/", import.meta.url)),
      env: { ...process.env, STORE_AUTH_TEST_CONTAINER: container, STORE_BASE_URL: "http://127.0.0.1:39999" }, stdio: "inherit",
    });
    if (integration.error) throw integration.error;
    if (integration.status !== 0) throw new Error("Encrypted storage integration checks failed");

    const scope = "'123','client','https://shopify.com/authentication/123','https://store.test/api/reviews/auth/callback'";
    sql(`insert into public.store_customer_authorizations(state_hash,browser_binding_hash,shop_id,client_id,issuer,redirect_uri,encrypted_flow)
      values(repeat('a',64),repeat('b',64),${scope},'v1.test.'||repeat('a',48));`);
    const consume = `select public.store_consume_customer_authorization(repeat('a',64),repeat('b',64),${scope})`;
    await race(consume, consume);
    console.log("PASS: competing callbacks consume one authorization exactly once");

    sql(`insert into public.store_customer_sessions(session_hash,shop_id,client_id,issuer,subject,encrypted_tokens,access_expires_at,expires_at)
      values(repeat('1',64),'123','client','https://shopify.com/authentication/123','buyer','v1.test.'||repeat('a',48),now()+interval '1 hour',now()+interval '1 day');`);
    await race(
      "select public.store_revoke_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123')",
      "select public.store_rotate_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123',0,'v1.test.'||repeat('b',48),now()+interval '2 hours')",
    );
    if (sql("select revoked_at is not null and encrypted_tokens is null from public.store_customer_sessions where session_hash=repeat('1',64)") !== "t") throw new Error("A refresh revived revoked tokens");
    console.log("PASS: logout racing token refresh keeps the session revoked");
    sql("select public.store_begin_review_photo('123','photo-quota','100',gen_random_uuid(),repeat('a',64),100,48,32) from generate_series(1,4)");
    await race(
      "select (public.store_begin_review_photo('123','photo-quota','100',gen_random_uuid(),repeat('a',64),100,48,32)->>'outcome')='allocated'",
      "select (public.store_begin_review_photo('123','photo-quota','100',gen_random_uuid(),repeat('a',64),100,48,32)->>'outcome')='allocated'",
    );
    console.log("PASS: concurrent photo allocation cannot exceed the fifth active slot");
    const photoId = sql("insert into public.store_review_photo_drafts(shop_id,customer_subject,product_id,request_key,sha256,byte_size,width,height,state) values('123','photo-claim','100',gen_random_uuid(),repeat('a',64),100,48,32,'ready') returning id").split(/\r?\n/)[0];
    if (!/^[0-9a-f-]{36}$/.test(photoId)) throw new Error("Invalid synthetic photo ID");
    sql(`insert into storage.objects(bucket_id,name) values('store-review-photos','123/${photoId}.webp')`);
    const claim = (line) => `select outcome='created' from public.store_submit_review_with_photos('123','photo-claim','900','${line}','100',null,'Shirt',null,4.5,'Great shirt','Love it','anonymous','Anonymous Ryan',array['${photoId}'::uuid])`;
    await race(claim("777"), claim("778"));
    if (sql("select count(*)=1 from public.store_reviews where customer_subject='photo-claim'") !== "t") throw new Error("Rejected photo claim left a review");
    console.log("PASS: a competing photo claim has one owner and rolls back the rejected review");
    sql("select public.store_consume_review_photo_budget('123','budget-race') from generate_series(1,29)");
    const budget = "select (public.store_consume_review_photo_budget('123','budget-race')->>'allowed')::boolean";
    await race(budget, budget);
    console.log("PASS: concurrent uploads cannot exceed the shared buyer attempt budget");
    const writeRule = `jsonb_build_array(jsonb_build_object('bucket','submit:buyer','actor','write-race','limit',5,'windowSeconds',3600))`;
    sql(`select public.store_consume_review_write_budget('123',${writeRule}) from generate_series(1,4)`);
    const write = `select (public.store_consume_review_write_budget('123',${writeRule})->>'allowed')::boolean`;
    await race(write, write);
    console.log("PASS: concurrent review writes cannot exceed the shared write budget");
  }
} finally {
  try {
    run("supabase", ["stop", "--project-id", projectId, "--no-backup", "--workdir", testRoot], undefined, true);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}
