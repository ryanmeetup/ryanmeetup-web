import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const migration = await readFile(
  path.join(appRoot, "supabase/migrations/20261027000000_ryd_access_group.sql"),
  "utf8",
);
const readAccessMigration = (
  await readFile(
    path.join(appRoot, "supabase/migrations/20261102000000_ryd_read_access.sql"),
    "utf8",
  )
)
  .replace(/^begin;$/m, "")
  .replace(/^commit;$/m, "");
const fixture = await readFile(
  path.join(appRoot, "tests/database/ryd-access.sql"),
  "utf8",
);
// The CLI copies test files into its container without their sibling migrations.
// Inline the real migration so the test exercises it after provisioning users.
const directory = await mkdtemp(path.join(tmpdir(), "ryd-access-test-"));
try {
  const sqlPath = path.join(directory, "ryd-access.sql");
  await writeFile(
    sqlPath,
    fixture
      .replaceAll("-- APPLY_RYD_ACCESS_MIGRATION", () => migration)
      .replaceAll("-- APPLY_RYD_READ_ACCESS_MIGRATION", () => readAccessMigration),
  );
  const result = spawnSync(
    "supabase",
    ["test", "db", sqlPath, "--workdir", appRoot],
    {
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
