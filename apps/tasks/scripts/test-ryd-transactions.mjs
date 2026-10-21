import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

// This test can only reach the local Docker database. Clone its schema into a
// disposable database so committed race fixtures never touch app/demo data.
const container = "supabase_db_ryanmeetup-tasks";
const database = `ryd_review_${randomBytes(6).toString("hex")}`;
const actor = "00000000-0000-4000-8000-000000000291";
const form = "f".repeat(30);
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const tap = spawnSync(
  "supabase",
  ["test", "db", "tests/database/ryd-transactions.sql", "--workdir", appRoot],
  { stdio: "inherit" },
);
if (tap.error) throw tap.error;
if (tap.status !== 0) process.exit(tap.status ?? 1);

function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const sql = (text, target = database) =>
  run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "supabase_admin",
      "-XAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-d",
      target,
    ],
    text,
  );

function connection(name) {
  const child = spawn("docker", [
    "exec",
    "-i",
    "-e",
    `PGAPPNAME=${name}`,
    container,
    "psql",
    "-U",
    "supabase_admin",
    "-XAt",
    "-v",
    "ON_ERROR_STOP=1",
    "-v",
    "VERBOSITY=verbose",
    "-d",
    database,
  ]);
  let stdout = "";
  let stderr = "";
  let ready;
  const locked = new Promise((resolve) => {
    ready = resolve;
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    if (stdout.includes("ryd-test-locked")) ready();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
  return { child, locked, exited };
}

async function race(first, second) {
  const a = connection("ryd-race-a");
  a.child.stdin.write(`begin;\n${first};\n\\echo ryd-test-locked\n`);
  await Promise.race([
    a.locked,
    a.exited.then((r) => {
      throw new Error(
        r.stderr || "First writer exited before acquiring its lock",
      );
    }),
  ]);
  const b = connection("ryd-race-b");
  b.child.stdin.end(`${second};\n`);
  try {
    const until = Date.now() + 5000;
    while (
      sql(
        "select exists(select 1 from pg_stat_activity where application_name='ryd-race-b' and wait_event_type='Lock');",
      ) !== "t"
    ) {
      if (Date.now() > until)
        throw new Error(
          "Second writer did not wait on the first writer's lock",
        );
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    a.child.stdin.end("commit;\n");
  }
  const [left, right] = await Promise.all([a.exited, b.exited]);
  if (left.code !== 0 || right.code === 0 || !right.stderr.includes("RY409"))
    throw new Error(
      `Expected one commit and one conflict: ${left.stderr} ${right.stderr}`,
    );
}

try {
  sql(`create database ${database};`, "postgres");
  const schema = run("docker", [
    "exec",
    container,
    "pg_dump",
    "-U",
    "supabase_admin",
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--exclude-schema=supabase_migrations",
    "postgres",
  ]);
  sql(schema);
  sql(`insert into auth.users(id,email,raw_user_meta_data) values ('${actor}','race@example.test','{}');
    set session_replication_role=replica;
    update public.profiles set app_role='owner',onboarding_completed=true where id='${actor}';
    set session_replication_role=origin;
    insert into public.instance_settings(id,ryd_enabled) values(true,true);
    insert into public.ryd_settings(id,form_id) values(true,'${form}');
    insert into public.ryd_imports(id,filename,headers,row_count,new_count,uploaded_by)
      values('20000000-0000-4000-8000-000000000291','race.csv','[]',2,2,'${actor}');
    insert into public.ryd_orders(order_id,raw,first_import_id) values
      ('race-1','{}','20000000-0000-4000-8000-000000000291'),
      ('race-2','{}','20000000-0000-4000-8000-000000000291');`);
  await race(
    `select public.ryd_change_submission('${actor}','race-1','race-response','link','${form}')`,
    `select public.ryd_change_submission('${actor}','race-2','race-response','link','${form}')`,
  );
  if (
    sql(
      "select count(*) from public.ryd_order_submissions where submission_key='race-response';",
    ) !== "1"
  )
    throw new Error("A response was claimed twice");
  console.log("PASS: competing response claims serialize and retain one owner");
  await race(
    `select public.ryd_change_submission('${actor}',null,'race-dismiss','dismiss','${form}')`,
    `select public.ryd_change_submission('${actor}','race-2','race-dismiss','link','${form}')`,
  );
  console.log("PASS: concurrent dismissal and linking cannot both commit");
  sql(
    `select public.ryd_review_order('${actor}','race-2','{"status":"verified"}');`,
  );
  await race(
    `select public.ryd_set_production('${actor}',array['race-2'],'done')`,
    `select public.ryd_review_order('${actor}','race-2','{"status":"rejected"}')`,
  );
  if (
    sql(
      "select status='verified' and done_at is not null from public.ryd_orders where order_id='race-2';",
    ) !== "t"
  )
    throw new Error("A stale decision changed an order in production");
  console.log(
    "PASS: a decision racing production rechecks the committed lock state",
  );
} finally {
  run("docker", [
    "exec",
    container,
    "dropdb",
    "-U",
    "supabase_admin",
    "--if-exists",
    "--force",
    database,
  ]);
}
