begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid='public.store_review_write_budgets'::regclass), 'write budgets have RLS');
select ok(not has_table_privilege('anon','public.store_review_write_budgets','select,insert,update,delete'), 'anon cannot reach write budgets');
select ok(not has_table_privilege('authenticated','public.store_review_write_budgets','select,insert,update,delete'), 'Tasks members cannot reach write budgets');
select ok(not has_function_privilege('anon','public.store_consume_review_write_budget(text,jsonb)','execute'), 'anon cannot consume a write budget');
select ok(not has_function_privilege('authenticated','public.store_consume_review_write_budget(text,jsonb)','execute'), 'Tasks members cannot consume a write budget');
select ok(has_function_privilege('service_role','public.store_consume_review_write_budget(text,jsonb)','execute'), 'Store server can consume a write budget');
select ok(not (select prosecdef from pg_proc where oid='public.store_consume_review_write_budget(text,jsonb)'::regprocedure), 'budget cannot elevate its caller');

create function pg_temp.rule(bucket text, actor text, max_attempts integer, window_seconds integer default 3600) returns jsonb
  language sql as $$ select jsonb_build_object('bucket', bucket, 'actor', actor, 'limit', max_attempts, 'windowSeconds', window_seconds) $$;
create function pg_temp.allowed(shop text, rules jsonb) returns boolean
  language sql as $$ select (public.store_consume_review_write_budget(shop, rules)->>'allowed')::boolean $$;

select is((select count(*) from generate_series(1,3) where pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-a',3)))), 3::bigint, 'attempts up to the limit are allowed');
select is(pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-a',3))), false, 'the attempt past the limit is denied');
select ok((public.store_consume_review_write_budget('123', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-a',3)))->>'retryAfter')::integer between 1 and 3600, 'a denial carries a bounded retry');
select is(pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-b',3))), true, 'budgets are actor scoped');
select is(pg_temp.allowed('124', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-a',3))), true, 'budgets are shop scoped');
select is(pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('edit:buyer','buyer-a',3))), true, 'budgets are bucket scoped');

-- All or nothing: a full rule refuses the call without spending the others.
select is(pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('submit:network','net-1',10), pg_temp.rule('submit:buyer','buyer-a',3))), false, 'one exhausted rule refuses the whole call');
select is((select count(*) from public.store_review_write_budgets where bucket='submit:network' and actor='net-1'), 0::bigint, 'a refused call consumes no other rule');
select is(pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('submit:network','net-1',10), pg_temp.rule('submit:buyer','buyer-c',3))), true, 'a call with room in every rule is allowed');
select is((select attempts from public.store_review_write_budgets where bucket='submit:network' and actor='net-1'), 1, 'an allowed call consumes every rule');

select is((select count(*) from generate_series(1,2) where pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-d',2,60), pg_temp.rule('submit:buyer-day','buyer-d',5,86400)))), 2::bigint, 'the short window fills first');
select ok((public.store_consume_review_write_budget('123', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-d',2,60), pg_temp.rule('submit:buyer-day','buyer-d',5,86400)))->>'retryAfter')::integer <= 60, 'retry follows the exhausted window');

update public.store_review_write_budgets set window_started_at=clock_timestamp()-interval '61 minutes' where actor='buyer-a' and bucket='submit:buyer' and shop_id='123';
select is(pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-a',3))), true, 'an expired window resets');
select is((select attempts from public.store_review_write_budgets where shop_id='123' and bucket='submit:buyer' and actor='buyer-a'), 1, 'a reset begins at one');

update public.store_review_write_budgets set window_started_at=clock_timestamp()-interval '3 days' where actor='buyer-b';
select is(pg_temp.allowed('123', jsonb_build_array(pg_temp.rule('submit:buyer','buyer-e',3))), true, 'cleanup runs with an allowed call');
select is((select count(*) from public.store_review_write_budgets where actor='buyer-b'), 0::bigint, 'rows past every window are removed');

select throws_ok($$select public.store_consume_review_write_budget('123', '[]'::jsonb)$$, '22023', null, 'an empty rule list is refused');
select throws_ok($$select public.store_consume_review_write_budget('shop', jsonb_build_array(pg_temp.rule('submit:buyer','x',3)))$$, '22023', null, 'a malformed shop is refused');
select throws_ok($$select public.store_consume_review_write_budget('123', jsonb_build_array(pg_temp.rule('Submit','x',3)))$$, '22023', null, 'a malformed bucket is refused');
select throws_ok($$select public.store_consume_review_write_budget('123', jsonb_build_array(pg_temp.rule('submit:buyer','x',0)))$$, '22023', null, 'a zero limit is refused');
select throws_ok($$select public.store_consume_review_write_budget('123', jsonb_build_array(pg_temp.rule('submit:buyer','x',3,30)))$$, '22023', null, 'a window under a minute is refused');
select throws_ok($$select public.store_consume_review_write_budget('123', jsonb_build_array(pg_temp.rule('submit:buyer','x',3,90000)))$$, '22023', null, 'a window over a day is refused');

select * from finish();
rollback;
