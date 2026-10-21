import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const migration = await readFile(
  path.join(
    appRoot,
    "supabase/migrations/20261101000000_ryd_contract_health.sql",
  ),
  "utf8",
);
const fixture = await readFile(
  path.join(appRoot, "tests/database/ryd-contract.sql"),
  "utf8",
);
const readAccessMigration = await readFile(
  path.join(appRoot, "supabase/migrations/20261102000000_ryd_read_access.sql"),
  "utf8",
);
const directory = await mkdtemp(path.join(tmpdir(), "ryd-contract-test-"));
try {
  const sqlPath = path.join(directory, "ryd-contract.sql");
  // Keep function creation and every simulated drift inside the test rollback.
  const definition = migration
    .replace(/^begin;$/m, "")
    .replace(/^commit;$/m, "");
  await writeFile(
    sqlPath,
    fixture
      .replace("-- APPLY_RYD_CONTRACT_MIGRATION", () => definition)
      .replace("-- APPLY_RYD_READ_ACCESS_MIGRATION", () =>
        readAccessMigration
          .replace(/^begin;$/m, "")
          .replace(/^commit;$/m, ""),
      ),
  );
  const result = spawnSync(
    "supabase",
    ["test", "db", sqlPath, "--workdir", appRoot],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
