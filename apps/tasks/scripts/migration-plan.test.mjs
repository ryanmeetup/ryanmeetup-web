import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { copyScopedMigrationSources, migrationTarget, readMigrationCatalog, selectMigrations } from "./migration-plan.mjs";

const shared = "20261120120000";
const extension = "20261120130000";

function fixture(t, manifest = { rmtOnly: [extension] }) {
  const directory = mkdtempSync(join(tmpdir(), "migration-plan-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "migrations"));
  writeFileSync(join(directory, "migration-scopes.json"), JSON.stringify(manifest));
  writeFileSync(join(directory, "migrations", `${shared}_tasks.sql`), "-- shared\nselect 1;\n");
  writeFileSync(join(directory, "migrations", `${extension}_store_auth.sql`), "-- RMT only\nselect 2;\n");
  return directory;
}

test("RMT receives both scopes and PRD receives shared Tasks migrations only", (t) => {
  const directory = fixture(t);
  const catalog = readMigrationCatalog(directory);
  assert.deepEqual(selectMigrations(catalog, "rmt").map(({ version }) => version), [shared, extension]);
  assert.deepEqual(selectMigrations(catalog, "prd").map(({ version }) => version), [shared]);
  assert.equal(catalog[1].body, "-- RMT only\nselect 2;");
  assert.equal(readFileSync(join(directory, "migrations", `${extension}_store_auth.sql`), "utf8"), "-- RMT only\nselect 2;\n");
});

test("invalid targets cannot silently choose a profile", () => {
  for (const target of [undefined, "PRD", "production", "", "personal"]) assert.throws(() => migrationTarget(target), /rmt or prd/);
});

test("unclassified store migrations and nonexistent scope entries fail closed", (t) => {
  assert.throws(() => readMigrationCatalog(fixture(t, { rmtOnly: [] })), /explicit rmtOnly entry/);
  assert.throws(() => readMigrationCatalog(fixture(t, { rmtOnly: [extension, "20261120999999"] })), /missing migration/);
});

test("malformed and duplicate scope metadata is rejected", (t) => {
  for (const manifest of [null, [], {}, { rmtOnly: [extension, extension] }, { rmtOnly: [123] }, { rmtOnly: [extension], typo: [] }]) {
    assert.throws(() => readMigrationCatalog(fixture(t, manifest)), /Invalid migration scope manifest/);
  }
});

test("duplicate migration versions are rejected before planning", (t) => {
  const directory = fixture(t);
  writeFileSync(join(directory, "migrations", `${shared}_another.sql`), "select 3;");
  assert.throws(() => readMigrationCatalog(directory), /duplicate migration/);
});

test("a scoped workspace omits RMT SQL and linked credentials without editing sources", (t) => {
  const source = fixture(t);
  const destination = join(source, "..", `profile-${source.split("-").at(-1)}`);
  t.after(() => rmSync(destination, { recursive: true, force: true }));
  mkdirSync(join(source, ".temp"));
  mkdirSync(join(source, ".branches"));
  writeFileSync(join(source, ".temp", "project-ref"), "linked-production-id");
  writeFileSync(join(source, ".branches", "secret"), "linked-secret");
  writeFileSync(join(source, "config.toml"), 'project_id = "fixture"\n');
  copyScopedMigrationSources(destination, "prd", source);
  assert.ok(existsSync(join(destination, "migrations", `${shared}_tasks.sql`)));
  assert.ok(!existsSync(join(destination, "migrations", `${extension}_store_auth.sql`)));
  assert.ok(!existsSync(join(destination, ".temp")));
  assert.ok(!existsSync(join(destination, ".branches")));
  assert.ok(existsSync(join(source, "migrations", `${extension}_store_auth.sql`)));
  assert.equal(readFileSync(join(destination, "config.toml"), "utf8"), 'project_id = "fixture"\n');
  assert.deepEqual(readMigrationCatalog(destination).map(({ version }) => version), [shared]);
  assert.deepEqual(JSON.parse(readFileSync(join(source, "migration-scopes.json"), "utf8")), { rmtOnly: [extension] });
});

test("the applied store-auth migration is explicitly RMT-only in the real catalog", () => {
  const catalog = readMigrationCatalog();
  assert.equal(catalog.find(({ version }) => version === extension)?.scope, "rmt");
  assert.ok(selectMigrations(catalog, "rmt").some(({ version }) => version === extension));
  assert.ok(!selectMigrations(catalog, "prd").some(({ version }) => version === extension));
});
