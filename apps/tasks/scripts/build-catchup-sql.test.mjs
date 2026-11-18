import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildCatchupSql } from "./build-catchup-sql.mjs";
import { readMigrationCatalog, selectMigrations } from "./migration-plan.mjs";

const catalog = [
  { version: "20261101000000", name: "baseline", file: "20261101000000_baseline.sql", scope: "shared", body: "select 'baseline';" },
  { version: "20261102000000", name: "tasks", file: "20261102000000_tasks.sql", scope: "shared", body: "select 'tasks';" },
  { version: "20261103000000", name: "store_auth", file: "20261103000000_store_auth.sql", scope: "rmt", body: "create table store_only_fixture(id integer);" },
  { version: "20261104000000", name: "future_tasks", file: "20261104000000_future_tasks.sql", scope: "shared", body: "select 'future_tasks';" },
];

test("PRD catch-up excludes store SQL, its history record, and its prerequisite guard", () => {
  const plan = buildCatchupSql("20261101000000", { catalog });
  assert.equal(plan.target, "prd");
  assert.deepEqual(plan.pending.map(({ name }) => name), ["tasks", "future_tasks"]);
  assert.ok(!plan.sql.includes("store_only_fixture"));
  assert.ok(!plan.sql.includes("20261103000000"));
  assert.match(plan.sql, /shared Tasks migrations only/);
  assert.match(plan.sql, /\]::text\[\]/);
});

test("RMT catch-up retains every extension in global version order", () => {
  const plan = buildCatchupSql("20261101000000", { target: "rmt", catalog });
  assert.deepEqual(plan.pending.map(({ name }) => name), ["tasks", "store_auth", "future_tasks"]);
  assert.ok(plan.sql.indexOf("select 'tasks';") < plan.sql.indexOf("create table store_only_fixture"));
  assert.ok(plan.sql.indexOf("create table store_only_fixture") < plan.sql.indexOf("select 'future_tasks';"));
  assert.match(plan.sql, /\('20261103000000', 'store_auth'\)/);
});

test("PRD that already received the extension keeps its objects and history untouched", () => {
  const held = "20261101000000,20261102000000,20261103000000";
  const plan = buildCatchupSql(held, { catalog });
  assert.deepEqual(plan.expected, ["20261101000000", "20261102000000"]);
  assert.deepEqual(plan.pending.map(({ name }) => name), ["future_tasks"]);
  assert.ok(!plan.sql.includes("20261103000000"));
  assert.ok(!/\b(drop|delete|truncate)\b/i.test(plan.sql));
  assert.match(plan.warnings[0], /remain untouched/);
});

test("literal history with a gap still applies the missing shared migration", () => {
  const plan = buildCatchupSql("20261101000000,20261104000000", { catalog });
  assert.deepEqual(plan.pending.map(({ name }) => name), ["tasks"]);
  assert.match(plan.sql, /older than a migration/);
  assert.deepEqual(plan.expected, ["20261101000000", "20261104000000"]);
});

test("an up-to-date PRD profile needs no schema or migration-history writes", () => {
  const plan = buildCatchupSql("20261104000000", { catalog });
  assert.equal(plan.pending.length, 0);
  assert.match(plan.sql, /^-- PRD is up to date/);
  assert.ok(!/\b(create|insert|alter)\b/i.test(plan.sql));
});

test("unknown historical entries are reported but never invented as prerequisites", () => {
  const plan = buildCatchupSql("20261101000000,20251001000000", { catalog });
  assert.match(plan.warnings[0], /20251001000000/);
  assert.ok(!plan.sql.includes("20251001000000"));
});

test("malformed history and ambiguous target names cannot generate SQL", () => {
  for (const held of [undefined, "", "2026-11-01", "20261101000000;drop"]) assert.throws(() => buildCatchupSql(held, { catalog }), /applied migration/);
  assert.throws(() => buildCatchupSql("20261101000000", { target: "production", catalog }), /rmt or prd/);
});

test("real PRD history excludes every registered RMT extension", () => {
  const real = readMigrationCatalog();
  const held = selectMigrations(real, "prd").map(({ version }) => version).join(",");
  assert.equal(buildCatchupSql(held, { catalog: real }).pending.length, 0);
  const rmt = buildCatchupSql(held, { target: "rmt", catalog: real });
  assert.deepEqual(rmt.pending.map(({ version }) => version), real.filter(({ scope }) => scope === "rmt").map(({ version }) => version));
  assert.ok(rmt.sql.includes("create table if not exists public.store_customer_sessions"));
  assert.ok(rmt.sql.includes("create or replace function public.store_moderate_review"));
});

test("the CLI defaults to PRD and replaces a stale output with a harmless no-op", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "catchup-cli-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, "catchup.sql");
  writeFileSync(output, "create table stale_store_sql(id integer);\n");
  const held = selectMigrations(readMigrationCatalog(), "prd").map(({ version }) => version).join(",");
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./build-catchup-sql.mjs", import.meta.url)), held, output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 pending PRD migrations/);
  assert.match(readFileSync(output, "utf8"), /^-- PRD is up to date/);
  assert.ok(!readFileSync(output, "utf8").includes("stale_store_sql"));
});
