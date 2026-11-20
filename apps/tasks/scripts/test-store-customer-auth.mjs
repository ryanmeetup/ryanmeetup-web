import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function run(command, args, input, inherit = false) {
  const result = spawnSync(command, args, { cwd: appRoot, input, encoding: "utf8", stdio: inherit ? "inherit" : undefined, maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed (${result.status})`);
  return result.stdout?.trim();
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
  const config = readFileSync(configPath, "utf8")
    .replace('project_id = "ryanmeetup-tasks"', `project_id = "${projectId}"`)
    .replace("port = 54321", "port = 55421")
    .replace("port = 54322", "port = 55422")
    .replace("shadow_port = 54320", "shadow_port = 55420");
  if (!config.startsWith(`project_id = "${projectId}"`) || projectId === "ryanmeetup-tasks") throw new Error("Refusing to use the app's Supabase project");
  writeFileSync(configPath, config);
  run("supabase", ["start", "--workdir", testRoot, "--exclude", "realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"], undefined, true);
  run("supabase", ["db", "reset", "--local", "--no-seed", "--yes", "--workdir", testRoot], undefined, true);
  const applied = sql("select string_agg(version, ',' order by version) from supabase_migrations.schema_migrations");
  if (applied !== selected.map(({ version }) => version).join(",")) throw new Error("Reset history does not match the selected migration profile");
  if (target === "prd") {
    const privateObjectsAbsent = sql("select to_regclass('public.store_customer_authorizations') is null and to_regclass('public.store_customer_sessions') is null and to_regclass('public.store_reviews') is null and not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'store_%review%') and not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname in ('store_get_customer_authorization','store_consume_customer_authorization','store_get_customer_session','store_rotate_customer_session','store_revoke_customer_session','store_revoke_customer_buyer_sessions'))");
    if (privateObjectsAbsent !== "t") throw new Error("RMT-only store objects leaked into the PRD profile");
    if (sql("select to_regclass('public.store_review_photo_drafts') is null and to_regclass('public.store_review_revision_photos') is null and to_regclass('public.store_review_photo_budgets') is null and not exists(select 1 from storage.buckets where id='store-review-photos')") !== "t") throw new Error("Photo staging leaked into PRD");
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
    console.log("PASS: full migration reset and idempotent auth and review migration replay");
    run("supabase", ["test", "db", "--workdir", testRoot, join(appRoot, "tests/database/store-customer-auth.sql"), join(appRoot, "tests/database/store-reviews.sql"), join(appRoot, "tests/database/store-buyer-reviews.sql"), join(appRoot, "tests/database/store-review-photo-staging.sql"), join(appRoot, "tests/database/store-review-photo-attachments.sql"), join(appRoot, "tests/database/store-review-photo-reads.sql"), join(appRoot, "supabase/tests/access_control.sql")], undefined, true);
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
    const claim = (line) => `select outcome='created' from public.store_submit_review_with_photos('123','photo-claim','900','${line}','100',null,'Shirt',null,5::smallint,'Great shirt','Love it','anonymous','Anonymous Ryan',array['${photoId}'::uuid])`;
    await race(claim("777"), claim("778"));
    if (sql("select count(*)=1 from public.store_reviews where customer_subject='photo-claim'") !== "t") throw new Error("Rejected photo claim left a review");
    console.log("PASS: a competing photo claim has one owner and rolls back the rejected review");
    sql("select public.store_consume_review_photo_budget('123','budget-race') from generate_series(1,29)");
    const budget = "select (public.store_consume_review_photo_budget('123','budget-race')->>'allowed')::boolean";
    await race(budget, budget);
    console.log("PASS: concurrent uploads cannot exceed the shared buyer attempt budget");
  }
} finally {
  try {
    run("supabase", ["stop", "--project-id", projectId, "--no-backup", "--workdir", testRoot], undefined, true);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}
