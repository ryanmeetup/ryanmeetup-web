begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
-- APPLY_RYD_CONTRACT_MIGRATION

-- Every drift simulation rolls back its DDL before returning the diagnostic.
create function pg_temp.health_after(change text) returns jsonb language plpgsql as $$
declare result jsonb;
begin
  begin
    execute change;
    result := public.ryd_contract_health();
    raise exception using errcode='Z0001';
  exception when sqlstate 'Z0001' then return result;
  end;
end;
$$;
select is(public.ryd_contract_health()->>'contractOk','true','clean committed schema satisfies the RY-D contract');
select is(public.ryd_contract_health()->'failures','[]'::jsonb,'healthy check returns no diagnostics');
set local role service_role;
select lives_ok('select public.ryd_contract_health()','service role can inspect the contract');
set local role anon;
select throws_ok('select public.ryd_contract_health()','42501',null,'anonymous cannot inspect private metadata');
set local role authenticated;
select throws_ok('select public.ryd_contract_health()','42501',null,'member cannot inspect private metadata');
set local role postgres;

select is(pg_temp.health_after('alter table public.ryd_submitter_contacts rename to missing_contacts')->>'contractOk','false','missing table fails');
select is(pg_temp.health_after('alter table public.ryd_orders rename column updated_at to missing_revision')->>'contractOk','false','missing column fails');
select is(pg_temp.health_after('alter table public.ryd_orders disable row level security')->>'contractOk','false','disabled RLS fails');
select is(pg_temp.health_after('create policy unsafe on public.ryd_orders for select to authenticated using (true)')->>'contractOk','false','unexpected RLS policy fails even without table grants');
select is(pg_temp.health_after('grant select on public.ryd_orders to authenticated')->>'contractOk','false','member table grant fails');
select is(pg_temp.health_after('grant select (email) on public.ryd_orders to anon')->>'contractOk','false','column-only grant fails');
select is(pg_temp.health_after('revoke update on public.ryd_orders from service_role')->>'contractOk','false','missing one service privilege fails');
select is(pg_temp.health_after('alter function public.ryd_move_production(uuid,uuid,jsonb) rename to missing_production')->>'contractOk','false','missing RPC signature fails');
select is(pg_temp.health_after('grant execute on function public.ryd_review_order(uuid,text,jsonb,text,text[]) to public')->>'contractOk','false','public mutation RPC grant fails');
select is(pg_temp.health_after('revoke execute on function public.ryd_import_orders(uuid,uuid,jsonb) from service_role')->>'contractOk','false','missing service execute fails');
select is(pg_temp.health_after('alter function public.ryd_review_order(uuid,text,jsonb,text,text[]) reset search_path')->>'contractOk','false','unsafe RPC search path fails');
select is(pg_temp.health_after('alter table public.ryd_orders drop constraint ryd_orders_verified_production_check')->>'contractOk','false','missing production invariant fails');
select is(pg_temp.health_after('alter table public.ryd_orders drop constraint ryd_orders_verified_production_check; alter table public.ryd_orders add constraint ryd_orders_verified_production_check check (true)')->>'contractOk','false','weakened constraint under the same name fails');
select is(pg_temp.health_after('alter table public.ryd_write_receipts drop constraint ryd_write_receipts_pkey; alter table public.ryd_write_receipts add primary key (actor_id)')->>'contractOk','false','changed retry receipt key fails');
select is(pg_temp.health_after('drop index public.ryd_order_submissions_one_order_idx')->>'contractOk','false','missing unique response claim fails');
select is(pg_temp.health_after('drop index public.ryd_fulfillment_one_prepared_idx')->>'contractOk','false','missing singleton prepared snapshot fails');
select is(pg_temp.health_after('alter table public.ryd_settings disable trigger ryd_guard_form_change')->>'contractOk','false','disabled form guard fails');
select is(pg_temp.health_after('alter table public.ryd_order_submissions disable trigger ryd_guard_reserved_evidence')->>'contractOk','false','disabled evidence reservation guard fails');
select is(pg_temp.health_after($$delete from public.workspace_area_access where area='ryd'$$)->>'contractOk','false','missing page metadata fails');
select is(public.ryd_contract_health()->>'contractOk','true','drift simulations leave the schema healthy');
select * from finish();
rollback;
