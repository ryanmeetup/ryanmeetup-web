import { cpSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const supabaseDirectory = fileURLToPath(new URL("../supabase/", import.meta.url));

export function migrationTarget(value) {
  if (value !== "rmt" && value !== "prd") throw new Error("Migration target must be rmt or prd.");
  return value;
}

/** Immutable SQL stays in one canonical directory; scope selects its consumers. */
export function readMigrationCatalog(directory = supabaseDirectory) {
  const manifest = JSON.parse(readFileSync(join(directory, "migration-scopes.json"), "utf8"));
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
    Object.keys(manifest).length !== 1 || !Array.isArray(manifest.rmtOnly) ||
    manifest.rmtOnly.some((version) => typeof version !== "string" || !/^\d{14}$/.test(version)) ||
    new Set(manifest.rmtOnly).size !== manifest.rmtOnly.length) throw new Error("Invalid migration scope manifest.");
  const rmtOnly = new Set(manifest.rmtOnly);
  const seen = new Set();
  const migrations = readdirSync(join(directory, "migrations")).filter((file) => file.endsWith(".sql")).sort().map((file) => {
    const match = /^(\d{14})_([a-z][a-z0-9_]*)\.sql$/.exec(file);
    if (!match || seen.has(match[1])) throw new Error(`Invalid or duplicate migration version: ${file}`);
    const [, version, name] = match;
    seen.add(version);
    if (/^(store|rmt)_/.test(name) && !rmtOnly.has(version)) throw new Error(`Ryan Meetup migration ${file} needs an explicit rmtOnly entry.`);
    return { file, version, name, scope: rmtOnly.has(version) ? "rmt" : "shared", body: readFileSync(join(directory, "migrations", file), "utf8").replace(/\n+$/, "") };
  });
  for (const version of rmtOnly) if (!seen.has(version)) throw new Error(`Scope references missing migration ${version}.`);
  return migrations;
}

export function selectMigrations(catalog, target) {
  migrationTarget(target);
  return catalog.filter((migration) => target === "rmt" || migration.scope === "shared");
}

/**
 * Copy scoped SQL/config, never linked-project metadata. Before invoking the CLI,
 * callers MUST give the copied config its own project ID and isolated ports.
 */
export function copyScopedMigrationSources(destination, target, source = supabaseDirectory) {
  const selected = selectMigrations(readMigrationCatalog(source), target);
  const included = new Set(selected.map(({ file }) => file));
  cpSync(source, destination, {
    recursive: true,
    filter: (path) => {
      if ([".temp", ".branches"].includes(basename(path))) return false;
      return dirname(path) !== join(source, "migrations") || included.has(basename(path));
    },
  });
  return selected;
}
