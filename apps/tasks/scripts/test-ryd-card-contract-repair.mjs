import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Only the local Docker database is reachable. The schema and synthetic data
// live in a disposable database, never in an instance's customer database.
const container = "supabase_db_ryanmeetup-tasks";
const database = `ryd_card_repair_${randomBytes(6).toString("hex")}`;
const actor = "00000000-0000-4000-8000-000000000916";
const migration = readFileSync(new URL("../supabase/migrations/20261116000000_ryd_card_contract_repair.sql", import.meta.url), "utf8");
function run(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const sql = (input, target = database) => run([
  "exec", "-i", container, "psql", "-U", "supabase_admin", "-XAt", "-v", "ON_ERROR_STOP=1", "-d", target,
], input);
const health = () => JSON.parse(sql("select public.ryd_contract_health();"));
const rules = () => sql(`select jsonb_object_agg(signature, pg_get_functiondef(signature::regprocedure)) from unnest(array[
  'public.member_can_view_workspace_area(uuid,text)', 'public.ryd_require_operator(uuid)',
  'public.ryd_review_orders(uuid,jsonb,text,text[])', 'public.ryd_contract_health()'
]) signature;`);

try {
  sql(`create database ${database};`, "postgres");
  sql(run(["exec", container, "pg_dump", "-U", "supabase_admin", "--schema-only", "--no-owner", "postgres"]));
  sql(`insert into auth.users(id,email,raw_user_meta_data) values('${actor}','repair@example.test','{}');
    set session_replication_role=replica;
    update public.profiles set app_role='owner',onboarding_completed=true where id='${actor}';
    set session_replication_role=origin;
    insert into public.workspace_area_access(area,access_mode,updated_by) values('ryd','restricted','${actor}');
    insert into public.instance_settings(id,ryd_enabled) values(true,false);`);
  assert.deepEqual(health(), { failures: [], contractOk: true });
  const originalRules = rules();

  sql(`drop function public.ryd_create_card_batch(uuid,uuid);
    drop table public.ryd_card_batch_orders, public.ryd_card_batches;
    drop function public.ryd_card_complete(public.ryd_orders);
    alter table public.ryd_orders drop column card_first_name, drop column card_last_name,
      drop column card_location, drop column card_ryan_since, drop column card_saved_by, drop column card_saved_at;
    alter table public.ryd_write_receipts drop constraint ryd_write_receipts_kind_check;
    alter table public.ryd_write_receipts add constraint ryd_write_receipts_kind_check
      check(kind in ('import','reminder','production','contact'));
    drop function public.ryd_fulfillment_is_ready(uuid);
    drop function public.ryd_generate_fulfillment(uuid,text[]);`);
  const expected = [
    ...["batch_id", "first_name", "last_name", "location", "order_id", "position", "ryan_since"].map((column) => `Missing column: ryd_card_batch_orders.${column}`),
    ...["created_at", "created_by", "id", "order_count"].map((column) => `Missing column: ryd_card_batches.${column}`),
    ...["card_first_name", "card_last_name", "card_location", "card_ryan_since", "card_saved_at", "card_saved_by"].map((column) => `Missing column: ryd_orders.${column}`),
    "Missing or changed constraint: ryd_orders_card_shape", "Missing or changed constraint: ryd_write_receipts_kind_check",
    "Missing primary key: ryd_card_batch_orders", "Missing primary key: ryd_card_batches",
    "Missing table: ryd_card_batch_orders", "Missing table: ryd_card_batches",
    "Unsafe or missing RPC: ryd_card_complete(public.ryd_orders)", "Unsafe or missing RPC: ryd_create_card_batch(uuid,uuid)",
    "Unsafe or missing RPC: ryd_fulfillment_is_ready(uuid)", "Unsafe or missing RPC: ryd_generate_fulfillment(uuid,text[])",
  ].sort();
  assert.deepEqual(health(), { failures: expected, contractOk: false });
  console.log(`PASS: reproduced all ${expected.length} reported PRD contract failures`);

  sql(migration);
  assert.deepEqual(health(), { failures: [], contractOk: true });
  assert.equal(rules(), originalRules);
  assert.equal(sql("select ryd_enabled from public.instance_settings where id;"), "f");
  console.log("PASS: repair restores the complete contract and preserves access, bulk reviews, and disabled RY-D");

  sql(`insert into public.ryd_imports(id,filename,headers,row_count,new_count,uploaded_by)
    values('20000000-0000-4000-8000-000000000916','synthetic.csv','[]',1,1,'${actor}');
    insert into public.ryd_orders(order_id,raw,first_import_id,card_first_name,card_last_name,card_location,card_ryan_since)
    values('repair-order','{"private":"synthetic"}','20000000-0000-4000-8000-000000000916','Ryan','Test','Brooklyn','1999');
    insert into public.ryd_card_batches(id,order_count,created_by)
    values('40000000-0000-4000-8000-000000000916',1,'${actor}');
    insert into public.ryd_card_batch_orders(batch_id,order_id,position,first_name,last_name,location,ryan_since)
    values('40000000-0000-4000-8000-000000000916','repair-order',0,'Ryan','Test','Brooklyn','1999');`);
  const data = () => sql(`select jsonb_build_object(
    'orders',(select jsonb_agg(to_jsonb(o)) from public.ryd_orders o),
    'batches',(select jsonb_agg(to_jsonb(b)) from public.ryd_card_batches b),
    'cards',(select jsonb_agg(to_jsonb(c)) from public.ryd_card_batch_orders c));`);
  const before = data();
  sql(migration);
  assert.deepEqual(health(), { failures: [], contractOk: true });
  assert.equal(data(), before);
  assert.equal(rules(), originalRules);
  console.log("PASS: rerunning the repair preserves existing order and card-batch data");

  sql(`grant execute on function public.ryd_fulfillment_is_ready(uuid) to anon;
    revoke execute on function public.ryd_generate_fulfillment(uuid,text[]) from service_role;`);
  assert.equal(health().contractOk, false);
  sql(migration);
  assert.deepEqual(health(), { failures: [], contractOk: true });
  console.log("PASS: unsafe grants and missing service-role grants are repaired too");
} finally {
  run(["exec", container, "dropdb", "-U", "supabase_admin", "--if-exists", "--force", database]);
}
