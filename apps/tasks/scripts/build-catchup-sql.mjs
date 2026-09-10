#!/usr/bin/env node
/**
 * Builds the paste-ready SQL for an instance this machine cannot reach.
 *
 * PRD gets its schema by hand — see docs/DATABASE.md — and handing over one
 * migration at a time is how an instance ends up half-applied. This writes
 * every migration the instance does not have into a single transaction, in
 * order, ending with the rows that record them in `supabase_migrations`, so
 * the next reading of that table is right.
 *
 * The block refuses to run anywhere it does not belong: it checks that every
 * migration it expects to be there already is, and that none of its own are,
 * and a failed check rolls the whole transaction back rather than leaving a
 * database half a schema ahead.
 *
 *   node scripts/build-catchup-sql.mjs 20260912000000 [out.sql]
 *   node scripts/build-catchup-sql.mjs "20260731000000, 20260905000000, ..." [out.sql]
 *
 * One version means the instance is on it: everything up to and including it
 * is applied. A list means exactly those are applied and nothing else is, so
 * paste back what the history query returned. That second form is the one to
 * reach for, because an instance can be behind in the middle as easily as at
 * the end, and PRD was: on 2026-09-10 it held 20261003000000 while missing
 * the four versions before it. A block built from "on 20260928000000" would
 * have carried a migration it already had, and its own guard would have
 * refused it.
 *
 * Ask the instance what it holds rather than assuming; the query is in
 * docs/DATABASE.md under "Outstanding".
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url)
  .pathname;
const [held, out = "catchup.sql"] = process.argv.slice(2);
const heldVersions = (held ?? "").split(/[,\s]+/).filter(Boolean);

if (!heldVersions.length || heldVersions.some((v) => !/^\d{14}$/.test(v))) {
  console.error(
    "Usage: node scripts/build-catchup-sql.mjs <version it is on | applied versions> [out.sql]",
  );
  process.exit(1);
}

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const versions = migrations.map((file) => file.slice(0, 14));
// One version is shorthand for "everything up to here"; a list is literal.
const applied =
  heldVersions.length === 1
    ? new Set(versions.filter((version) => version <= heldVersions[0]))
    : new Set(heldVersions);

const unknown = [...applied].filter((version) => !versions.includes(version));
if (unknown.length)
  console.warn(
    `Note: ${unknown.join(", ")} applied there with no file here. Left out of the guard.`,
  );

const expected = versions.filter((version) => applied.has(version));
const pending = migrations
  .filter((file) => !applied.has(file.slice(0, 14)))
  .map((file) => ({
    file,
    version: file.slice(0, 14),
    name: file.slice(15, -4),
    body: readFileSync(join(migrationsDir, file), "utf8").replace(/\n+$/, ""),
  }));

if (pending.length === 0) {
  console.error("That instance already has every migration in this repository.");
  process.exit(1);
}

const rule = `-- ${"-".repeat(73)}`;
const first = pending[0].version;
const last = pending.at(-1).version;

// A version older than one the database already has is the case worth naming.
const outOfOrder = pending.some(({ version }) =>
  [...applied].some((appliedVersion) => appliedVersion > version),
);

const sql = `-- Catch-up: ${pending.length} migration${pending.length === 1 ? "" : "s"}, ${first} through ${last}
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
  ]) as expected
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

writeFileSync(out, sql);
console.log(
  `${out}: ${pending.length} migrations, ${first} through ${last}, ${sql.split("\n").length} lines`,
);
