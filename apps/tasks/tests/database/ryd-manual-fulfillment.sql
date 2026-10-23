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

-- Simulate the old saved draft. Generation ignores it and never changes it.
insert into public.ryd_fulfillment_snapshots(id,recipient,headers,order_rows,verified_ids,response_keys,prepared_by)
  values('30000000-0000-4000-8000-000000000301','old@example.test','[]','[]',array['snapshot-1'],'{}','00000000-0000-4000-8000-000000000301');
select is(jsonb_array_length(public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-1','snapshot-1'])->'order_rows'),1,'generate exactly the selected ready orders, deduplicated');
select ok(not (public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-1']) ? 'id'),'generated files have no saved batch identity');
select is((select count(*) from public.ryd_fulfillment_snapshots),1::bigint,'repeated generation never saves another draft');
select is((select state from public.ryd_fulfillment_snapshots),'prepared','generation never cancels or changes the historical draft');
select ok((select cleared_batch_id is null and production_sent_at is null from public.ryd_orders where order_id='snapshot-1'),'generation leaves the order ready to send');
select is((select count(*) from public.ryd_fulfillment_batches),0::bigint,'generation records no handoff');
select is((select count(*) from public.ryd_order_events where action='sent'),0::bigint,'generation records no email send');
select lives_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-1','{"note":"No draft reservation"}')$$,'old saved drafts no longer reserve decisions');
select lives_ok($$select public.ryd_change_submission('00000000-0000-4000-8000-000000000301','snapshot-1','snapshot-new','link',repeat('f',30))$$,'generation and old drafts no longer reserve evidence');
select public.ryd_review_order('00000000-0000-4000-8000-000000000301','snapshot-2','{"status":"verified"}');
select is(jsonb_array_length(public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-2'])->'order_rows'),1,'another selection generates immediately without discarding a prior email');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',null)$$,'RY400',null,'a selection is required');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301','{}')$$,'RY400',null,'empty selection is refused');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array_fill('snapshot-1'::text,array[5001]))$$,'RY400',null,'oversized selections are not truncated');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-3'])$$,'RY409',null,'pending orders are excluded');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['missing'])$$,'RY409',null,'missing IDs do not expand to the full queue');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-production'])$$,'RY409',null,'in-production orders are excluded');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-done'])$$,'RY409',null,'done orders are excluded');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000302',array['snapshot-1'])$$,'42501',null,'generation rechecks actor access');
select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000301','[{"orderId":"snapshot-1","from":"ready-to-send","to":"sent-to-fulfillment"}]');
select ok((select cleared_batch_id is not null and production_sent_at is null and done_at is null from public.ryd_orders where order_id='snapshot-1'),'only the manual stage action marks the selected order sent to fulfillment');
select ok((select cleared_batch_id is null from public.ryd_orders where order_id='snapshot-2'),'unselected ready orders remain ready');
select is((select count(*) from public.ryd_fulfillment_snapshots),1::bigint,'manual stage changes save no emails');
select ok((select recipient is null from public.ryd_fulfillment_batches),'manual tracking stores no email recipient or content');
select throws_ok($$select public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-1','snapshot-2'])$$,'RY409',null,'mixed ready and already-sent selections fail together');
select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000301','[{"orderId":"snapshot-1","from":"ready-to-send","to":"sent-to-fulfillment"}]');
select is((select count(*) from public.ryd_fulfillment_batches),1::bigint,'retry records the manual handoff once');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000302','[{"orderId":"snapshot-1","from":"ready-to-send","to":"in-production"}]')$$,'RY409',null,'a stale stage cannot be moved');
select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000303','[{"orderId":"snapshot-1","from":"sent-to-fulfillment","to":"in-production"}]');
select ok((select production_sent_at is not null and done_at is null from public.ryd_orders where order_id='snapshot-1'),'manual acknowledgment starts production separately');
select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000304','[{"orderId":"snapshot-1","from":"in-production","to":"done"}]');
select ok((select done_at is not null from public.ryd_orders where order_id='snapshot-1'),'completion is manual');
select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000305','[{"orderId":"snapshot-1","from":"done","to":"in-production"}]');
select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000306','[{"orderId":"snapshot-1","from":"in-production","to":"sent-to-fulfillment"}]');
select is((select count(*) from public.ryd_fulfillment_batches),1::bigint,'moving production back preserves the existing handoff record');
select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000307','[{"orderId":"snapshot-1","from":"sent-to-fulfillment","to":"ready-to-send"}]');
select ok((select cleared_batch_id is null and production_sent_at is null and done_at is null from public.ryd_orders where order_id='snapshot-1'),'manual move back makes an order ready again');
select is(jsonb_array_length(public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',array['snapshot-1'])->'order_rows'),1,'manually returned ready orders can be included again');
create function pg_temp.fail_manual_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable'; end$$;
create trigger fail_manual_audit before insert on public.ryd_order_events for each row execute function pg_temp.fail_manual_audit();
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000301','40000000-0000-4000-8000-000000000308','[{"orderId":"snapshot-2","from":"ready-to-send","to":"sent-to-fulfillment"}]')$$,'P0001','audit unavailable','manual stage and audit commit together');
select ok((select cleared_batch_id is null from public.ryd_orders where order_id='snapshot-2'),'failed audit rolls back the stage change');
select is((select count(*) from public.ryd_fulfillment_batches),1::bigint,'failed audit rolls back the handoff record');
drop trigger fail_manual_audit on public.ryd_order_events;
select ok(not has_function_privilege('authenticated','public.ryd_generate_fulfillment(uuid,text[])','EXECUTE'),'members cannot bypass the privileged route');
select ok(not has_function_privilege('anon','public.ryd_generate_fulfillment(uuid,text[])','EXECUTE'),'anonymous callers cannot generate private files');
insert into public.ryd_orders(order_id,raw,first_import_id,status)
  select 'manual-extra-' || n,'{}','20000000-0000-4000-8000-000000000301','verified' from generate_series(1,1001) n;
set local role service_role;
select is(jsonb_array_length(public.ryd_generate_fulfillment('00000000-0000-4000-8000-000000000301',(select array_agg(order_id) from public.ryd_orders where order_id like 'manual-extra-%'))->'order_rows'),1001,'on-demand generation includes all selected IDs beyond the Data API cap');
set local role postgres;
select is(public.ryd_contract_health()->>'contractOk','true','manual workflow satisfies the updated database contract');
select * from finish();
rollback;
