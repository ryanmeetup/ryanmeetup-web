begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000601','bulk-owner@example.test','{}'),
 ('00000000-0000-4000-8000-000000000602','bulk-denied@example.test','{}'),
 ('00000000-0000-4000-8000-000000000603','bulk-other-owner@example.test','{}');
set local session_replication_role=replica;
update public.profiles set app_role='owner',onboarding_completed=true where id in ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000603');
update public.profiles set app_role='member',onboarding_completed=true where id='00000000-0000-4000-8000-000000000602';
set local session_replication_role=origin;
insert into public.instance_settings(id,ryd_enabled) values(true,true) on conflict(id) do update set ryd_enabled=true;
insert into public.ryd_settings(id,form_id) values(true,repeat('f',30)) on conflict(id) do update set form_id=excluded.form_id;
insert into public.ryd_imports(id,filename,headers,row_count,new_count,uploaded_by)
 values('20000000-0000-4000-8000-000000000601','bulk.csv','[]',4,4,'00000000-0000-4000-8000-000000000601');
insert into public.ryd_orders(order_id,raw,first_import_id,status,production_sent_at,done_at) values
 ('bulk-a','{}','20000000-0000-4000-8000-000000000601','verified',now(),now()),
 ('bulk-b','{}','20000000-0000-4000-8000-000000000601','verified',now(),null),
 ('bulk-c','{}','20000000-0000-4000-8000-000000000601','verified',null,null),
 ('bulk-d','{}','20000000-0000-4000-8000-000000000601','pending',null,null);

create function pg_temp.back_moves() returns jsonb language sql as $$select '[{"orderId":"bulk-a","from":"done","to":"in-production"},{"orderId":"bulk-b","from":"in-production","to":"not-started"}]'::jsonb$$;
set local role service_role;
select is(public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000601',pg_temp.back_moves())->>'movedCount','2','service role moves a mixed backward selection together');
set local role postgres;
select ok((select production_sent_at is not null and done_at is null from public.ryd_orders where order_id='bulk-a'),'done order moves back exactly one step');
select ok((select production_sent_at is null and done_at is null from public.ryd_orders where order_id='bulk-b'),'in-production order moves back exactly one step');
select is(public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000601',pg_temp.back_moves())->>'movedCount','2','retry returns the original moved count');
select ok((select production_sent_at is not null from public.ryd_orders where order_id='bulk-a'),'retry cannot move back a second time');
select is((select count(*) from public.ryd_order_events where action='production'),2::bigint,'production retry adds no duplicate history');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000603','60000000-0000-4000-8000-000000000601',pg_temp.back_moves())$$,'RY409',null,'receipt cannot be replayed by a different owner');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000601','[{"orderId":"bulk-c","from":"not-started","to":"done"}]')$$,'RY409',null,'receipt cannot be reused for another selection');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000602','[{"orderId":"bulk-a","from":"in-production","to":"done"},{"orderId":"bulk-b","from":"in-production","to":"not-started"}]')$$,'RY409',null,'one stale original stage rejects the whole group');
select ok((select done_at is null from public.ryd_orders where order_id='bulk-a'),'a stale group leaves other orders unchanged');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000602','[{"orderId":"bulk-a","from":"in-production","to":"done"},{"orderId":"missing","from":"not-started","to":"done"}]')$$,'RY409',null,'a deleted order rejects the whole group');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000602','[{"orderId":"bulk-d","from":"not-started","to":"done"}]')$$,'RY409',null,'unverified orders cannot move');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000601',null,pg_temp.back_moves())$$,'RY400',null,'production needs an operation key');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000602',(select jsonb_agg(jsonb_build_object('orderId',i::text,'from','not-started','to','done')) from generate_series(1,101) i))$$,'RY400',null,'SQL also limits each production group to 100');
create function pg_temp.fail_bulk_audit() returns trigger language plpgsql as $$begin if new.order_id='bulk-c' then raise exception 'audit unavailable'; end if; return new; end$$;
create trigger fail_bulk_audit before insert on public.ryd_order_events for each row execute function pg_temp.fail_bulk_audit();
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000602','[{"orderId":"bulk-a","from":"in-production","to":"done"},{"orderId":"bulk-c","from":"not-started","to":"in-production"}]')$$,'P0001','audit unavailable','second-stage audit failure rolls back every stage');
select ok((select done_at is null from public.ryd_orders where order_id='bulk-a'),'earlier stage rolls back with the later audit');
select is((select count(*) from public.ryd_write_receipts where operation_id='60000000-0000-4000-8000-000000000602'),0::bigint,'failed production leaves no receipt');
drop trigger fail_bulk_audit on public.ryd_order_events;

set local role service_role;
select is(public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','70000000-0000-4000-8000-000000000601',array['One@example.test','two@example.test','one@example.test'])->>'markedCount','2','service role normalizes and deduplicates one contact confirmation');
set local role postgres;
select is((select count(*) from public.ryd_submitter_contacts),2::bigint,'one contact row per distinct person');
select is(public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','70000000-0000-4000-8000-000000000601',array['two@example.test','ONE@example.test'])->>'markedCount','2','retry is independent of email case and order');
select is((select count(*) from public.ryd_submitter_contacts),2::bigint,'contact retry cannot add attempts');
select is(public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','70000000-0000-4000-8000-000000000602',array['one@example.test'])->'contacts'->'one@example.test'->>'attempts','2','a deliberately new confirmation records a new attempt');
select is(public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','70000000-0000-4000-8000-000000000601',array['one@example.test','two@example.test'])->'contacts'->'one@example.test'->>'attempts','2','old receipt replay returns current canonical contact totals');
select ok((select not result::text like '%example.test%' from public.ryd_write_receipts where operation_id='70000000-0000-4000-8000-000000000601'),'receipt does not copy the contact recipient list');
select throws_ok($$select public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000601',array['one@example.test'])$$,'RY409',null,'operation keys cannot cross operation kinds');
select throws_ok($$select public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','70000000-0000-4000-8000-000000000601',array['changed@example.test'])$$,'RY409',null,'operation keys cannot confirm a different contact group');
create function pg_temp.fail_contact() returns trigger language plpgsql as $$begin if new.email='zfail@example.test' then raise exception 'contact history unavailable'; end if; return new; end$$;
create trigger fail_contact before insert on public.ryd_submitter_contacts for each row execute function pg_temp.fail_contact();
select throws_ok($$select public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','70000000-0000-4000-8000-000000000603',array['afail@example.test','zfail@example.test'])$$,'P0001','contact history unavailable','partial contact insert rolls back');
select is((select count(*) from public.ryd_submitter_contacts where email='afail@example.test'),0::bigint,'earlier contact row rolls back');
select is((select count(*) from public.ryd_write_receipts where operation_id='70000000-0000-4000-8000-000000000603'),0::bigint,'failed contact group leaves no receipt');
drop trigger fail_contact on public.ryd_submitter_contacts;
select throws_ok($$select public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','70000000-0000-4000-8000-000000000603',array['bad,address@example.test'])$$,'RY400',null,'SQL rejects unsafe contact addresses');

select public.ryd_change_submission('00000000-0000-4000-8000-000000000601','bulk-a','zzz-claimed','link',repeat('f',30));
select throws_ok($$select public.ryd_link_submissions('00000000-0000-4000-8000-000000000601','bulk-b',array['aaa-new','zzz-claimed'],repeat('f',30))$$,'RY409',null,'a multi-response conflict rejects the whole link');
select is((select count(*) from public.ryd_order_submissions where submission_key='aaa-new'),0::bigint,'earlier response does not stay partially linked');
select is((select count(*) from public.ryd_order_events where detail->>'submission_key'='aaa-new'),0::bigint,'partial link history rolls back');
set local role service_role;
select lives_ok($$select public.ryd_link_submissions('00000000-0000-4000-8000-000000000601','bulk-b',array['aaa-new','bbb-new'],repeat('f',30))$$,'service role links the entire response group');
set local role postgres;
select is(public.ryd_link_submissions('00000000-0000-4000-8000-000000000601','bulk-b',array['bbb-new','aaa-new'],repeat('f',30))->>'changed','false','repeating a successful group adds no history');
select is((select count(*) from public.ryd_order_events where order_id='bulk-b' and action='linked'),2::bigint,'each response linked once');
select throws_ok($$select public.ryd_link_submissions('00000000-0000-4000-8000-000000000601','bulk-c',array['stale-form'],repeat('g',30))$$,'RY409',null,'multi-response linking rechecks the configured form');
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000602','60000000-0000-4000-8000-000000000603','[{"orderId":"bulk-c","from":"not-started","to":"done"}]')$$,'42501',null,'denied member cannot move production');
select throws_ok($$select public.ryd_record_contacts('00000000-0000-4000-8000-000000000602','70000000-0000-4000-8000-000000000603',array['one@example.test'])$$,'42501',null,'denied member cannot record contacts');
select throws_ok($$select public.ryd_link_submissions('00000000-0000-4000-8000-000000000602','bulk-c',array['denied-key'],repeat('f',30))$$,'42501',null,'denied member cannot link responses');
update public.instance_settings set ryd_enabled=false;
select throws_ok($$select public.ryd_move_production('00000000-0000-4000-8000-000000000601','60000000-0000-4000-8000-000000000601',pg_temp.back_moves())$$,'42501',null,'feature-off blocks even production receipt replays');
select throws_ok($$select public.ryd_record_contacts('00000000-0000-4000-8000-000000000601','70000000-0000-4000-8000-000000000601',array['one@example.test','two@example.test'])$$,'42501',null,'feature-off blocks even contact receipt replays');
select ok(not has_function_privilege('anon','public.ryd_move_production(uuid,uuid,jsonb)','EXECUTE'),'anonymous cannot call production RPC');
select ok(not has_function_privilege('authenticated','public.ryd_record_contacts(uuid,uuid,text[])','EXECUTE'),'members cannot call contact RPC');
select ok(not has_function_privilege('authenticated','public.ryd_link_submissions(uuid,text,text[],text,text)','EXECUTE'),'members cannot call grouped-link RPC');
select ok(not has_function_privilege('anon','public.ryd_bulk_receipt(uuid,uuid,text,jsonb)','EXECUTE'),'receipt helper is private');
select * from finish();
rollback;
