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

select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',null,null)$$,'RY409',null,'resume never creates an unselected batch');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301','{}',null)$$,'RY400',null,'empty selections fail');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array[null::text],null)$$,'RY400',null,'null IDs fail');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array_fill('snapshot-1'::text,array[5001]),null)$$,'RY400',null,'oversized selections fail without truncation');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000302',array['snapshot-1'],null)$$,'42501',null,'actor permission is checked inside the selection transaction');
select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-2','{"status":"verified"}');
create temp table selected_batch as select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-1','snapshot-1'],null) as manifest;
select is((select manifest->'verified_ids' from selected_batch),'["snapshot-1"]'::jsonb,'only the selected ready order is captured and duplicates are removed');
select is((select jsonb_array_length(manifest->'order_rows') from selected_batch),1,'other ready, pending and production orders are excluded from the CSV');
select is((select manifest->'response_keys' from selected_batch),'["snapshot-response"]'::jsonb,'only selected evidence is pinned');
select is(public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-1'],null)->>'id',(select manifest->>'id' from selected_batch),'retrying the same selection resumes the exact saved file');
select is(public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',null,null)->>'id',(select manifest->>'id' from selected_batch),'resume without a selection returns the saved file');
select is(public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-2'],null)->>'selection_conflict','true','a different selection requires explicit replacement');
select is((select count(*) from public.ryd_fulfillment_snapshots),1::bigint,'a conflict does not create or cancel a manifest');
select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-2','{"status":"pending"}');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-2'],(select (manifest->>'id')::uuid from selected_batch))$$,'RY409',null,'a stale selection is rejected before cancelling the old draft');
select is((select state from public.ryd_fulfillment_snapshots),'prepared','failed validation preserves the old reservation');
select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-2','{"status":"verified"}');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-2'],'00000000-0000-4000-8000-000000000999')$$,'RY409',null,'replacement cannot cancel a different operator draft');
create temp table replacement_batch as select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-2'],(select (manifest->>'id')::uuid from selected_batch)) as manifest;
select isnt((select manifest->>'id' from replacement_batch),(select manifest->>'id' from selected_batch),'replacement gets its own immutable identity');
select is((select state from public.ryd_fulfillment_snapshots where id=(select (manifest->>'id')::uuid from selected_batch)),'cancelled','explicit replacement cancels the prior draft');
select is((select order_rows from public.ryd_fulfillment_snapshots where id=(select (manifest->>'id')::uuid from selected_batch)),(select manifest->'order_rows' from selected_batch),'the cancelled manifest is retained unchanged');
select is((select manifest->'verified_ids' from replacement_batch),'["snapshot-2"]'::jsonb,'replacement contains exactly the new selection');
select is(public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-2'],(select (manifest->>'id')::uuid from selected_batch))->>'id',(select manifest->>'id' from replacement_batch),'retry after a lost replacement response resumes the replacement');
select lives_ok($$update public.ryd_orders set raw='{"OrderId":"snapshot-1","updated":"yes"}' where order_id='snapshot-1'$$,'replacement releases orders excluded from the new draft');
create function pg_temp.fail_selected_snapshot() returns trigger language plpgsql as $$begin raise exception 'manifest unavailable'; end$$;
create trigger selected_snapshot_failure before insert on public.ryd_fulfillment_snapshots for each row execute function pg_temp.fail_selected_snapshot();
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-1'],(select (manifest->>'id')::uuid from replacement_batch))$$,'P0001','manifest unavailable','failed creation rolls back the entire replacement');
select is((select state from public.ryd_fulfillment_snapshots where id=(select (manifest->>'id')::uuid from replacement_batch)),'prepared','failed replacement restores the previous draft and reservations');
drop trigger selected_snapshot_failure on public.ryd_fulfillment_snapshots;
select public.ryd_finish_fulfillment('00000000-0000-4000-8000-000000000301',(select (manifest->>'id')::uuid from replacement_batch),'confirm');
select ok((select cleared_batch_id is not null and production_sent_at is null from public.ryd_orders where order_id='snapshot-2'),'confirmation records only the selected email, awaiting production acknowledgment');
select ok((select cleared_batch_id is null from public.ryd_orders where order_id='snapshot-1'),'unselected ready orders remain available for a later file');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-1','snapshot-2'],null)$$,'RY409',null,'mixed ready and already emailed selections fail atomically');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-production'],null)$$,'RY409',null,'orders in production cannot be re-emailed');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-done'],null)$$,'RY409',null,'completed orders cannot be re-emailed');
select throws_ok($$select public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',array['missing'],null)$$,'RY409',null,'unknown IDs never expand to the whole queue');
select ok(not has_function_privilege('authenticated','public.ryd_prepare_selected_fulfillment(uuid,text[],uuid)','EXECUTE'),'members cannot call the privileged transaction directly');
select ok(not has_function_privilege('anon','public.ryd_prepare_selected_fulfillment(uuid,text[],uuid)','EXECUTE'),'anonymous callers cannot read or prepare manifests');
insert into public.ryd_orders(order_id,raw,first_import_id,status)
  select 'snapshot-selected-' || n, '{}', '20000000-0000-4000-8000-000000000301', 'verified' from generate_series(1,1001) n;
set local role service_role;
select is(jsonb_array_length(public.ryd_prepare_selected_fulfillment('00000000-0000-4000-8000-000000000301',(select array_agg(order_id) from public.ryd_orders where status='verified' and cleared_batch_id is null and production_sent_at is null),null)->'order_rows'),1002,'selected batches include every selected order beyond the Data API row cap');
set local role postgres;
select * from finish();
rollback;
