begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000901', 'bulk-review-owner@example.test', '{}');
set local session_replication_role = replica;
update public.profiles set app_role = 'owner', onboarding_completed = true
  where id = '00000000-0000-4000-8000-000000000901';
set local session_replication_role = origin;
insert into public.instance_settings(id, ryd_enabled) values(true, true)
  on conflict(id) do update set ryd_enabled = true;
insert into public.ryd_settings(id, form_id) values(true, 'bulk-review-form-1234567890')
  on conflict(id) do update set form_id = excluded.form_id;
insert into public.ryd_imports(id, filename, headers, row_count, new_count, uploaded_by)
  values('20000000-0000-4000-8000-000000000901', 'bulk.csv', '[]', 8, 8, '00000000-0000-4000-8000-000000000901');
insert into public.ryd_orders(order_id, raw, first_import_id) select name, '{"private":"original CSV"}',
  '20000000-0000-4000-8000-000000000901' from unnest(array[
    'bulk-a', 'bulk-b', 'bulk-locked', 'bulk-stale', 'bulk-plain', 'bulk-missing', 'bulk-fatal-a', 'bulk-fatal-b'
  ]) name;
update public.ryd_orders set status = 'verified', production_sent_at = now() where order_id = 'bulk-locked';
update public.ryd_orders set status = 'needs_info' where order_id = 'bulk-stale';

create function pg_temp.decision(id text, keys text[] default '{}', location text default 'Brooklyn')
returns jsonb language sql as $$
  select jsonb_build_object('orderId', id, 'status', 'verified', 'expectedStatus', 'pending',
    'card', jsonb_build_object('firstName', 'Ryan', 'lastName', 'Test', 'location', location, 'ryanSince', '1999'),
    'submissionKeys', keys)
$$;
create function pg_temp.review(decisions jsonb, known text[] default '{}', form_id text default 'bulk-review-form-1234567890')
returns jsonb language sql as $$
  select public.ryd_review_orders('00000000-0000-4000-8000-000000000901', decisions, form_id, known)
$$;

select ok(not has_function_privilege('anon', 'public.ryd_review_orders(uuid,jsonb,text,text[])', 'execute'), 'anonymous has no bulk review grant');
select ok(not has_function_privilege('authenticated', 'public.ryd_review_orders(uuid,jsonb,text,text[])', 'execute'), 'members have no direct bulk review grant');
select ok(has_function_privilege('service_role', 'public.ryd_review_orders(uuid,jsonb,text,text[])', 'execute'), 'service role can run bulk reviews');
select throws_ok($$select pg_temp.review('[]')$$, 'RY400', null, 'empty groups are refused');
select throws_ok($$select pg_temp.review('{}')$$, 'RY400', null, 'non-array groups are refused');
select throws_ok($$select pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-a'), pg_temp.decision('bulk-a')))$$,
  'RY400', null, 'duplicate orders are refused before writing');
select throws_ok($$select pg_temp.review((select jsonb_agg(pg_temp.decision('order-' || n)) from generate_series(1,101) n))$$,
  'RY400', null, 'oversized groups are refused');
select throws_ok($$select pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-a') || '{"note":"extra"}'::jsonb))$$,
  'RY400', null, 'unknown decision fields are refused');
update public.instance_settings set ryd_enabled = false where id;
select throws_ok($$select pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-a')))$$,
  '42501', null, 'database authority is rechecked even with service credentials');
update public.instance_settings set ryd_enabled = true where id;

create temporary table bulk_results as select pg_temp.review(jsonb_build_array(
  pg_temp.decision('bulk-a', array['shared-response']),
  pg_temp.decision('bulk-b', array['shared-response']),
  pg_temp.decision('bulk-locked') || '{"expectedStatus":"verified"}'::jsonb,
  pg_temp.decision('bulk-stale'),
  pg_temp.decision('bulk-plain'),
  pg_temp.decision('bulk-missing', array['deleted-response']),
  pg_temp.decision('bulk-no-longer-exists')
), array['shared-response']) as result;
select is((select jsonb_array_length(result->'reviews') from bulk_results), 2, 'eligible orders save together');
select is((select jsonb_array_length(result->'failures') from bulk_results), 5, 'each refused order is reported');
select is((select status from public.ryd_orders where order_id = 'bulk-a'), 'verified', 'suggested evidence is accepted with verification');
select is((select status from public.ryd_orders where order_id = 'bulk-plain'), 'verified', 'orders without evidence still verify');
select is((select order_id from public.ryd_order_submissions where submission_key = 'shared-response'), 'bulk-a', 'one response has only one owner');
select is((select status from public.ryd_orders where order_id = 'bulk-b'), 'pending', 'a claim conflict leaves the other decision unchanged');
select is((select card_first_name from public.ryd_orders where order_id = 'bulk-b'), null::text, 'a refused decision does not save its card');
select is((select count(*) from public.ryd_order_events where order_id in ('bulk-b', 'bulk-missing', 'bulk-stale', 'bulk-locked')), 0::bigint, 'refused orders leave no audit side effects');
select is((select count(*) from public.ryd_order_events where order_id = 'bulk-a' and action in ('linked', 'status', 'card')), 3::bigint, 'successful evidence, status and card changes are audited');
select ok((select not (result->'reviews'->0->'result'->'order') ? 'raw' from bulk_results), 'canonical responses omit raw CSV rows');

select is(jsonb_array_length(pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-b', '{}', '')))->'failures'), 1, 'unfinished cards are refused individually');
select is(jsonb_array_length(pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-b') || '{"expectedUpdatedAt":"2000-01-01T00:00:00Z"}'::jsonb))->'failures'), 1, 'a stale revision is refused even when the status has not changed');
select is(jsonb_array_length(pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-b', array['new-response'])), array['new-response'], 'old-form')->'failures'), 1, 'a changed configured form refuses provenance');
select is((select count(*) from public.ryd_order_submissions where submission_key = 'new-response'), 0::bigint, 'a changed form saves no response claims');
select is(jsonb_array_length(pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-b', array['aaa-unused-response', 'shared-response'])), array['aaa-unused-response', 'shared-response'])->'failures'), 1, 'a later evidence conflict refuses the whole order');
select is((select count(*) from public.ryd_order_submissions where submission_key = 'aaa-unused-response'), 0::bigint, 'earlier pairings roll back with a later pairing refusal');
select is(jsonb_array_length(pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-a', array['shared-response'])), array['shared-response'])->'failures'), 1, 'replaying a stale revision does not reapply a decision');

create function pg_temp.refuse_bulk_event() returns trigger language plpgsql as $$
begin
  if new.order_id = 'bulk-fatal-b' then raise exception 'Synthetic audit failure'; end if;
  return new;
end;
$$;
create trigger refuse_bulk_event before insert on public.ryd_order_events
  for each row execute function pg_temp.refuse_bulk_event();
select throws_ok($$select pg_temp.review(jsonb_build_array(pg_temp.decision('bulk-fatal-a'), pg_temp.decision('bulk-fatal-b')))$$,
  'P0001', 'Synthetic audit failure', 'unexpected failures abort the whole transaction');
select is((select count(*) from public.ryd_orders where order_id like 'bulk-fatal-%' and status = 'pending'), 2::bigint, 'earlier decisions roll back on an unexpected failure');
select is((select count(*) from public.ryd_order_events where order_id like 'bulk-fatal-%'), 0::bigint, 'no successful audit is lost on an unexpected failure');

select * from finish();
rollback;
