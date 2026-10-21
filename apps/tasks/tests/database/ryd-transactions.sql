begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000201', 'ryd-review-owner@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000202', 'ryd-review-member@example.test', '{}');
set local session_replication_role = replica;
update public.profiles set app_role = 'owner', onboarding_completed = true
  where id = '00000000-0000-4000-8000-000000000201';
update public.profiles set app_role = 'member', onboarding_completed = true
  where id = '00000000-0000-4000-8000-000000000202';
set local session_replication_role = origin;
insert into public.instance_settings(id, ryd_enabled) values(true, true)
  on conflict(id) do update set ryd_enabled = true;
insert into public.ryd_settings(id, form_id) values(true, repeat('f', 30))
  on conflict(id) do update set form_id = excluded.form_id;
insert into public.ryd_imports(id, filename, headers, row_count, new_count, uploaded_by)
  values('20000000-0000-4000-8000-000000000201', 'test.csv', '[]', 3, 3, '00000000-0000-4000-8000-000000000201');
insert into public.ryd_orders(order_id, raw, first_import_id) values
  ('test-1', '{}', '20000000-0000-4000-8000-000000000201'),
  ('test-2', '{}', '20000000-0000-4000-8000-000000000201'),
  ('test-3', '{}', '20000000-0000-4000-8000-000000000201');

select lives_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000201', 'test-1', 'zzz-claimed', 'link', repeat('f', 30))$$, 'links a response');
select lives_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000201', 'test-1', 'zzz-claimed', 'link', repeat('f', 30))$$, 'repeating a link is idempotent');
select is((select count(*) from public.ryd_order_events where action = 'linked'), 1::bigint, 'no audit event for a no-op link');
select throws_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000201', 'test-2', 'zzz-claimed', 'link', repeat('f', 30))$$, 'RY409', 'That response is already linked to an order. Unlink it there first.', 'a response has only one owner');
select throws_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000201', null, 'zzz-claimed', 'dismiss', repeat('f', 30))$$, 'RY409', 'That response is already linked to an order. Unlink it there first.', 'a claimed response cannot be dismissed');
select lives_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000201', null, 'removed-key', 'dismiss', repeat('f', 30))$$, 'dismisses an unclaimed response');
select throws_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000201', 'test-2', 'removed-key', 'link', repeat('f', 30))$$, 'RY409', 'That response was removed. Restore it before linking it.', 'a removed response cannot be claimed');
select throws_ok($$update public.ryd_settings set form_id = repeat('g',30)$$, 'RY409', 'This form has saved pairings or removed responses. Resolve them before changing the form.', 'source changes cannot orphan pairings');
select throws_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000201', 'test-2', 'another-key', 'link', repeat('g', 30))$$, 'RY409', 'The verification form changed. Refresh before trying again.', 'stale source validation cannot save a response');

select throws_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000201', 'test-2', '{"status":"verified"}', repeat('f',30), array['aaa-new', 'zzz-claimed'])$$, 'RY409', 'That response is already linked to an order. Unlink it there first.', 'accepting multiple suggestions is atomic');
select is((select count(*) from public.ryd_order_submissions where submission_key = 'aaa-new'), 0::bigint, 'failed verification rolls back its earlier new pairing');
select is((select status from public.ryd_orders where order_id = 'test-2'), 'pending', 'failed verification leaves the decision unchanged');
select lives_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000201', 'test-2', '{"status":"verified", "expectedStatus":"pending", "note":"Checked evidence"}', repeat('f',30), array['own-response'])$$, 'accepts a suggestion and decision in one operation');
select is((select count(*) from public.ryd_order_events where order_id = 'test-2'), 3::bigint, 'pairing, status, and note are all audited');
select throws_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000201', 'test-2', '{"status":"rejected", "expectedStatus":"pending"}')$$, 'RY409', 'This order changed while you were reviewing it. Refresh and review it again.', 'stale status is refused');

select lives_ok($$select public.ryd_set_production('00000000-0000-4000-8000-000000000201', array['test-2', 'test-3'], 'done')$$, 'production updates only verified orders');
select ok((select production_sent_at is not null and done_at is not null from public.ryd_orders where order_id='test-2'), 'done stamps both dates atomically');
select ok((select production_sent_at is null from public.ryd_orders where order_id='test-3'), 'pending order is untouched');
select is(public.ryd_set_production('00000000-0000-4000-8000-000000000201', array['test-2'], 'done')->>'movedCount', '0', 'repeating done is a no-op');
select is((select count(*) from public.ryd_order_events where action = 'production'), 1::bigint, 'no duplicate production audit event');
select throws_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000201', 'test-2', '{"status":"rejected"}')$$, 'RY409', 'This order is already with fulfillment or in production. Its decision cannot be changed.', 'production locks the decision inside the transaction');
select throws_ok($$update public.ryd_orders set status='rejected' where order_id='test-2'$$, '23514', null, 'the invariant also holds outside the RPC');

create function pg_temp.fail_ryd_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable'; end$$;
create trigger test_audit_failure before insert on public.ryd_order_events for each row execute function pg_temp.fail_ryd_audit();
select throws_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000201', 'test-1', '{"note":"Must roll back"}')$$, 'P0001', 'audit unavailable', 'audit failure fails the write');
select is((select note from public.ryd_orders where order_id='test-1'), null::text, 'note rolls back when its audit fails');
select throws_ok($$select public.ryd_set_production('00000000-0000-4000-8000-000000000201', array['test-2'], 'not-started')$$, 'P0001', 'audit unavailable', 'production fails if its audit cannot be saved');
select ok((select done_at is not null from public.ryd_orders where order_id='test-2'), 'production dates roll back with the audit');
select throws_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000201', 'test-1', 'failed-link', 'link', repeat('f', 30))$$, 'P0001', 'audit unavailable', 'linking requires a saved audit event');
select is((select count(*) from public.ryd_order_submissions where submission_key='failed-link'), 0::bigint, 'link rolls back with the audit');
drop trigger test_audit_failure on public.ryd_order_events;

select ok(not has_function_privilege('authenticated', 'public.ryd_review_order(uuid,text,jsonb,text,text[])','EXECUTE'), 'members cannot call privileged RPCs directly');
select ok(not has_function_privilege('anon', 'public.ryd_set_production(uuid,text[],text)','EXECUTE'), 'anonymous callers cannot call production RPCs');
insert into public.access_groups(id,name,kind,created_by) values
  ('10000000-0000-4000-8000-000000000201','RY-D transaction test team','team','00000000-0000-4000-8000-000000000201');
insert into public.access_group_members(group_id,profile_id,added_by) values
  ('10000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000201');
insert into public.workspace_area_group_grants(area,group_id,granted_by) values
  ('ryd','10000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000201');
set local role service_role;
select lives_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000202', 'test-1', '{"note":"Reviewed by the delegated team"}')$$, 'service role can execute a transaction for an authorized non-owner');
set local role postgres;
delete from public.workspace_area_group_grants where area='ryd' and group_id='10000000-0000-4000-8000-000000000201';
select throws_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000202', 'test-1', '{"status":"verified"}')$$, '42501', 'RY-D access is required.', 'actor must have real page authority');
delete from public.workspace_area_group_grants where area='ryd';
delete from public.workspace_area_access where area='ryd';
select throws_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000202', 'test-1', '{"status":"verified"}')$$, '42501', 'RY-D access is required.', 'missing page metadata does not grant write access');

select * from finish();
rollback;
