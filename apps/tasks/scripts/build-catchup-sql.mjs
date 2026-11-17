#!/usr/bin/env node
/**
 * Generate dashboard SQL from the target's migration profile and actual history.
 * PRD is the default: shared Tasks SQL only. RMT includes Ryan Meetup extensions.
 * Existing applied SQL/history is never removed or rewritten.
 *
 * Prefer the full history query output over the legacy highest-version shortcut:
 *   node scripts/build-catchup-sql.mjs "20260731000000, ..." catchup.sql
 *   node scripts/build-catchup-sql.mjs "20260731000000, ..." catchup.sql --target rmt
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { migrationTarget, readMigrationCatalog, selectMigrations } from "./migration-plan.mjs";

export function buildCatchupSql(held, { target = "prd", catalog = readMigrationCatalog() } = {}) {
  migrationTarget(target);
  const heldVersions = typeof held === "string" ? held.split(/[,\s]+/).filter(Boolean) : [];
  if (!heldVersions.length || heldVersions.some((version) => !/^\d{14}$/.test(version))) {
    throw new Error("Provide the applied migration versions from the target's history query.");
  }
  const migrations = selectMigrations(catalog, target);
  const versions = migrations.map(({ version }) => version);
  // One version retains the old prefix shorthand; a list is literal history.
  const applied = heldVersions.length === 1
    ? new Set(versions.filter((version) => version <= heldVersions[0]))
    : new Set(heldVersions);
  const allVersions = new Set(catalog.map(({ version }) => version));
  const unknown = [...new Set(heldVersions.filter((version) => !allVersions.has(version)))];
  const ignored = target === "prd" ? heldVersions.filter((version) => catalog.some((migration) => migration.version === version && migration.scope === "rmt")) : [];
  const warnings = [];
  if (unknown.length) warnings.push(`History entries with no source file are left out of the guard: ${unknown.join(", ")}.`);
  if (ignored.length) warnings.push(`RMT-only history entries are outside PRD's plan and remain untouched: ${ignored.join(", ")}.`);
  const expected = versions.filter((version) => applied.has(version));
  const pending = migrations.filter(({ version }) => !applied.has(version));
  if (!pending.length) {
    return { target, pending, expected, warnings, sql: `-- ${target.toUpperCase()} is up to date for its migration profile. No database changes.\n` };
  }
  const rule = `-- ${"-".repeat(73)}`;
  const first = pending[0].version;
  const last = pending.at(-1).version;

  // A version older than one the database already has is the case worth naming.
  const outOfOrder = pending.some(({ version }) =>
    [...applied].some((appliedVersion) => appliedVersion > version),
  );

  const sql = `-- ${target.toUpperCase()} catch-up: ${pending.length} migration${pending.length === 1 ? "" : "s"}, ${first} through ${last}
  --
  -- Run this whole file in the SQL Editor of the instance that is behind. It is
  -- one transaction: either all ${pending.length} migrations apply or none of them do.
  --
  -- Applying: ${pending.map(({ version }) => version).join(", ")}.${
    outOfOrder
      ? `
  -- Some of those are older than a migration this database already has, which
  -- is why the block was built from its history rather than from one version.`
      : ""
  }
  --
  -- Scope: ${target === "prd" ? "shared Tasks migrations only; RMT extensions excluded" : "shared Tasks migrations and Ryan Meetup extensions"}.
  -- Copied verbatim from apps/tasks/supabase/migrations, in order, and ending
  -- with the rows that record them in supabase_migrations.schema_migrations so
  -- the next reading of that table is right.

  begin;

  -- Refuses to run against a database that is not where this block expects it,
  -- rather than applying half a schema to it.
  do $catchup_guard$
  declare
    missing text;
    already text;
  begin
    select string_agg(expected, ', ' order by expected) into missing
    from unnest(array[
  ${expected.map((version) => `    '${version}'`).join(",\n")}
    ]::text[]) as expected
    where not exists (
      select 1 from supabase_migrations.schema_migrations applied
      where applied.version = expected
    );
    if missing is not null then
      raise exception
        'This block expects these to be applied here already, and they are not: %. Send that back and ask for a block built from what this database actually holds.', missing;
    end if;

    select string_agg(version, ', ' order by version) into already
    from supabase_migrations.schema_migrations
    where version in (
  ${pending.map(({ version }) => `      '${version}'`).join(",\n")}
    );
    if already is not null then
      raise exception
        'Already applied here: %. Send that back and ask for a block built from what this database actually holds.', already;
    end if;
  end
  $catchup_guard$;
  ${pending
    .map(
      ({ version, name, body }) => `
  ${rule}
  -- ${version}  ${name}
  ${rule}

  ${body}
  `,
    )
    .join("")}
  ${rule}
  -- Record what this block applied.
  ${rule}

  insert into supabase_migrations.schema_migrations (version, name)
  values
  ${pending.map(({ version, name }) => `  ('${version}', '${name}')`).join(",\n")};

  commit;
  `;

  return { target, pending, expected, warnings, sql };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({ options: { target: { type: "string", default: "prd" } }, allowPositionals: true });
    if (positionals.length > 2) throw new Error("Expected applied versions and an output path.");
    const [held, out = "catchup.sql"] = positionals;
    const plan = buildCatchupSql(held, { target: values.target });
    for (const warning of plan.warnings) console.warn(warning);
    // Overwrite a requested stale output even for a no-op, so it cannot carry
    // an old store-only migration after the caller is told PRD is up to date.
    writeFileSync(out, plan.sql);
    console.log(`${out}: ${plan.pending.length} pending ${plan.target.toUpperCase()} migrations`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not build migration SQL.");
    process.exitCode = 1;
  }
}
