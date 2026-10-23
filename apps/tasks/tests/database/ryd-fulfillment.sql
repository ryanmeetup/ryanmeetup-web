begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000301','snapshot-owner@example.test','{}'),
  ('00000000-0000-4000-8000-000000000302','snapshot-denied@example.test','{}');
set local session_replication_role = replica;
update public.profiles set app_role='owner',onboarding_completed=true where id='00000000-0000-4000-8000-000000000301';
update public.profiles set app_role='member',onboarding_completed=true where id='00000000-0000-4000-8000-000000000302';
set local session_replication_role = origin;
insert into public.instance_settings(id,ryd_enabled) values(true,true) on conflict(id) do update set ryd_enabled=true;
insert into public.ryd_settings(id,form_id,fulfillment_email) values(true,repeat('f',30),'fulfillment@example.test')
  on conflict(id) do update set form_id=excluded.form_id,fulfillment_email=excluded.fulfillment_email;
insert into public.ryd_imports(id,filename,headers,row_count,new_count,uploaded_by)
  values('20000000-0000-4000-8000-000000000301','snapshot.csv','["OrderId","Verified?"]',3,3,'00000000-0000-4000-8000-000000000301');
insert into public.ryd_orders(order_id,raw,first_import_id,status) values
  ('snapshot-1','{"OrderId":"snapshot-1"}','20000000-0000-4000-8000-000000000301','verified'),
  ('snapshot-2','{"OrderId":"snapshot-2"}','20000000-0000-4000-8000-000000000301','pending'),
  ('snapshot-3','{"OrderId":"snapshot-3"}','20000000-0000-4000-8000-000000000301','pending');
select public.ryd_change_submission('00000000-0000-4000-8000-000000000301','snapshot-1','snapshot-response','link',repeat('f',30));
insert into public.ryd_orders(order_id,raw,first_import_id,status,production_sent_at,done_at) values
  ('snapshot-production','{}','20000000-0000-4000-8000-000000000301','verified',now(),null),
  ('snapshot-done','{}','20000000-0000-4000-8000-000000000301','verified',now(),now());
create temp table test_snapshot as select (public.ryd_prepare_fulfillment('00000000-0000-4000-8000-000000000301')->>'id')::uuid as id;
select is(public.ryd_prepare_fulfillment('00000000-0000-4000-8000-000000000301')->>'id', (select id::text from test_snapshot), 'preparation resumes the same shared batch');
select is((select count(*) from public.ryd_fulfillment_snapshots where state='prepared'),1::bigint,'only one prepared batch exists');
set local role service_role;
select lives_ok($$select public.ryd_prepare_fulfillment('00000000-0000-4000-8000-000000000301')$$,'service role can resume a private manifest for an authorized actor');
set local role postgres;

select is((select jsonb_array_length(order_rows) from public.ryd_fulfillment_snapshots where id=(select id from test_snapshot)),1,'file contains only newly verified orders, excluding pending, in-production and done orders');
select is(public.ryd_fulfillment_is_ready((select id from test_snapshot)),true,'the new manifest is eligible to download and confirm');
select is((select response_keys from public.ryd_fulfillment_snapshots where id=(select id from test_snapshot)),array['snapshot-response'],'manifest pins evidence references');
update public.ryd_settings set fulfillment_email='changed@example.test';
select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-2','{"status":"verified"}');
insert into public.ryd_orders(order_id,raw,first_import_id,status) values
  ('snapshot-later','{}','20000000-0000-4000-8000-000000000301','verified');
select is((select verified_ids from public.ryd_fulfillment_snapshots where id=(select id from test_snapshot)),array['snapshot-1'],'later verifications do not change the ready list');
select throws_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-1','{"status":"rejected"}')$$,'RY409',null,'reserved decisions cannot change');
select throws_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000301','snapshot-1','snapshot-response','unlink',repeat('f',30))$$,'RY409',null,'reserved evidence cannot be removed');
select throws_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000301','snapshot-1','snapshot-new','link',repeat('f',30))$$,'RY409',null,'reserved evidence cannot be extended');
select throws_ok($$update public.ryd_orders set raw='{}' where order_id='snapshot-1'$$,'RY409',null,'reserved export data cannot change');
select lives_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-1','{"note":"A note does not change the file"}')$$,'notes remain editable without changing the manifest');
select throws_ok($$select public.ryd_prepare_fulfillment('00000000-0000-4000-8000-000000000302')$$,'42501',null,'denied members cannot prepare or resume customer manifests');
select throws_ok($$select public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000302',(select id from test_snapshot),'confirm')$$,'42501',null,'denied members cannot finish a batch');

create function pg_temp.fail_snapshot_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable'; end$$;
create trigger snapshot_audit_failure before insert on public.ryd_order_events for each row execute function pg_temp.fail_snapshot_audit();
select throws_ok($$select public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from test_snapshot),'confirm')$$,'P0001','audit unavailable','send confirmation requires saved history');
select is((select state from public.ryd_fulfillment_snapshots where id=(select id from test_snapshot)),'prepared','audit failure preserves the reservation');
select is((select cleared_batch_id from public.ryd_orders where order_id='snapshot-1'),null::uuid,'audit failure rolls back order clearing');
select is((select count(*) from public.ryd_fulfillment_batches where id=(select id from test_snapshot)),0::bigint,'audit failure rolls back the batch record');
drop trigger snapshot_audit_failure on public.ryd_order_events;
set local role service_role;
select is(public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from public.ryd_fulfillment_snapshots where state='prepared'),'confirm')->>'changed','true','confirmation commits the prepared batch');
set local role postgres;
select is((select cleared_batch_id from public.ryd_orders where order_id='snapshot-1'),(select id from test_snapshot),'exactly the snapshot ready order is cleared');
select ok((select production_sent_at is null and done_at is null from public.ryd_orders where order_id='snapshot-1'),'confirming the fulfillment email waits for a separate production acknowledgment');
select is((select count(*) from public.ryd_orders where order_id in ('snapshot-2','snapshot-later') and cleared_batch_id is null),2::bigint,'later ready orders wait for the next file');
select is((select order_count from public.ryd_fulfillment_batches where id=(select id from test_snapshot)),1,'later imports do not inflate the sent count');
select is((select recipient from public.ryd_fulfillment_batches where id=(select id from test_snapshot)),'fulfillment@example.test','confirmation retains the drafted recipient');
select is(public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from test_snapshot),'confirm')->>'changed','false','retrying confirmation is idempotent');
select is((select count(*) from public.ryd_order_events where action='sent'),1::bigint,'a retry adds no misleading duplicate send history');
select throws_ok($$select public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from test_snapshot),'cancel')$$,'RY409',null,'a confirmed batch cannot be cancelled');
create temp table next_snapshot as select (public.ryd_prepare_fulfillment('00000000-0000-4000-8000-000000000301')->>'id')::uuid as id;
select isnt((select id from next_snapshot),(select id from test_snapshot),'the next batch gets its own identity');
select is((select verified_ids from public.ryd_fulfillment_snapshots where id=(select id from next_snapshot)),array['snapshot-2','snapshot-later'],'the next batch includes only later verifications, never the previous batch or production orders');
select public.ryd_set_production('00000000-0000-4000-8000-000000000301',array['snapshot-2'],'in-production');
select is(public.ryd_fulfillment_is_ready((select id from next_snapshot)),false,'an order sent to production after preparation invalidates the pending send');
select throws_ok($$select public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from next_snapshot),'confirm')$$,'RY409',null,'confirmation rechecks production under row locks');
select public.ryd_set_production('00000000-0000-4000-8000-000000000301',array['snapshot-2'],'not-started');
-- A batch opened before this fix must remain immutable and require deliberate
-- cancellation, rather than silently replacing a file somebody may have sent.
update public.ryd_fulfillment_snapshots set order_rows=order_rows || '[{"order_id":"snapshot-3","status":"pending","raw":{}}]'::jsonb where id=(select id from next_snapshot);
select is(public.ryd_prepare_fulfillment('00000000-0000-4000-8000-000000000301')->>'requires_rebuild','true','legacy broad manifests are flagged for rebuilding');
select throws_ok($$select public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from next_snapshot),'confirm')$$,'RY409',null,'legacy broad manifests cannot be confirmed as a new send');
select is(public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from next_snapshot),'cancel')->>'changed','true','cancelling releases an unsent batch');
select is(public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from next_snapshot),'cancel')->>'changed','false','cancelling twice is idempotent');
select lives_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-2','{"status":"rejected"}')$$,'cancelled reservations no longer block review');
select throws_ok($$select public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select id from next_snapshot),'confirm')$$,'RY409',null,'a cancelled file cannot be confirmed');
select ok(not has_table_privilege('authenticated','public.ryd_fulfillment_snapshots','SELECT'),'members cannot read private manifests directly');
select ok(not has_function_privilege('authenticated','public.ryd_finish_fulfillment(uuid,uuid,text)','EXECUTE'),'members cannot bypass privileged route authorization');
select ok(not has_function_privilege('authenticated','public.ryd_fulfillment_is_ready(uuid)','EXECUTE'),'members cannot inspect private snapshot eligibility directly');
insert into public.ryd_orders(order_id,raw,first_import_id,status)
  select 'snapshot-extra-' || n, '{}', '20000000-0000-4000-8000-000000000301', 'verified' from generate_series(1,1001) n;
create temp table large_snapshot as select public.ryd_prepare_fulfillment('00000000-0000-4000-8000-000000000301') as manifest;
select is((select jsonb_array_length(manifest->'order_rows') from large_snapshot),1002,'snapshot creation includes more than the Data API row cap');
select is((select jsonb_array_length(manifest->'verified_ids') from large_snapshot),1002,'confirmation uses the complete ready list without a client ID body limit');
select public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select (manifest->>'id')::uuid from large_snapshot),'confirm');
select throws_ok($$select public.ryd_prepare_fulfillment('00000000-0000-4000-8000-000000000301')$$,'RY409','There are no unsent verified orders to prepare.','pending and production orders alone cannot create another batch');
select * from finish();
rollback;
