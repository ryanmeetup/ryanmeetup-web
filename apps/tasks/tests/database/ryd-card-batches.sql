begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000801', 'ryd-batch-owner@example.test', '{}');
set local session_replication_role = replica;
update public.profiles set app_role = 'owner', onboarding_completed = true
  where id = '00000000-0000-4000-8000-000000000801';
set local session_replication_role = origin;
insert into public.instance_settings(id, ryd_enabled) values(true, true)
  on conflict(id) do update set ryd_enabled = true;
insert into public.ryd_imports(id, filename, headers, row_count, new_count, uploaded_by)
  values('20000000-0000-4000-8000-000000000801', 'batch.csv', '[]', 5, 5, '00000000-0000-4000-8000-000000000801');
insert into public.ryd_orders(order_id, raw, first_import_id, status, created_at,
    card_first_name, card_last_name, card_location, card_ryan_since) values
  ('batch-1', '{}', '20000000-0000-4000-8000-000000000801', 'verified', now() - interval '2 days', 'Ryan', 'Pérez', 'Cleveland Ohio', '1976'),
  ('batch-2', '{}', '20000000-0000-4000-8000-000000000801', 'verified', now() - interval '1 day', 'Ryan', 'Le', 'Brooklyn, NY', '1999'),
  ('batch-legacy', '{}', '20000000-0000-4000-8000-000000000801', 'verified', now(), null, null, null, null),
  ('batch-pending', '{}', '20000000-0000-4000-8000-000000000801', 'pending', now(), 'Ryan', 'Waiting', 'Chicago', '2001'),
  ('batch-cancelled', '{}', '20000000-0000-4000-8000-000000000801', 'rejected', now(), 'Ryan', 'Gone', 'Austin', '2002');

create function pg_temp.pull(operation uuid) returns jsonb language sql as $$
  select public.ryd_create_card_batch('00000000-0000-4000-8000-000000000801', operation)
$$;

select is((pg_temp.pull('40000000-0000-4000-8000-000000000801')->>'orderCount')::integer, 2,
  'a batch takes every verified order with an approved card');
select is((select array_agg(order_id order by position) from public.ryd_card_batch_orders), array['batch-1', 'batch-2'],
  'oldest orders come first, and unapproved, pending, and cancelled cards stay out');
select ok((select bool_and(cleared_batch_id is not null and production_sent_at is not null)
  from public.ryd_orders where order_id in ('batch-1', 'batch-2')),
  'pulled orders are marked sent to fulfillment with the batch date');
select ok((select cleared_batch_id is null from public.ryd_orders where order_id = 'batch-legacy'),
  'a verified order without an approved card waits');
select is((select count(*) from public.ryd_order_events where action = 'sent' and detail ? 'cardBatch'), 2::bigint,
  'every pulled order is audited with its batch');

select is(pg_temp.pull('40000000-0000-4000-8000-000000000801'),
  (select receipt.result from public.ryd_write_receipts receipt where operation_id = '40000000-0000-4000-8000-000000000801'),
  'retrying the same download returns the same batch');
select is((select count(*) from public.ryd_card_batches), 1::bigint, 'a retry creates no second batch');
select is((pg_temp.pull('40000000-0000-4000-8000-000000000802')->>'orderCount')::integer, 0,
  'a new download has nothing left to print');
select is((select count(*) from public.ryd_card_batches), 1::bigint, 'an empty download records no batch');

-- A card corrected after the batch does not change what was printed.
select throws_ok($$select public.ryd_review_order('00000000-0000-4000-8000-000000000801', 'batch-2',
  '{"card":{"firstName":"Ryan","lastName":"Le","location":"Queens","ryanSince":"1999"}}')$$,
  'RY409', null, 'a pulled card is frozen');
select is((select location from public.ryd_card_batch_orders where order_id = 'batch-2'), 'Brooklyn, NY',
  'the batch keeps the approved card');

select throws_ok($$select public.ryd_create_card_batch('00000000-0000-4000-8000-000000000899', gen_random_uuid())$$,
  '42501', 'RY-D access is required.', 'only RY-D operators can pull cards');

select * from finish();
rollback;
