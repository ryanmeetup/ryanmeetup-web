begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.submit(line text, rating numeric)
returns table (review_id uuid, outcome text) language sql as $$
  select * from public.store_submit_review('123', 'half-' || line, '9100', line, '300', null, 'Half Shirt', null, rating, 'Solid', 'Great shirt.', 'anonymous', 'Anonymous');
$$;
create function pg_temp.approve(review uuid) returns boolean language sql as $$
  select public.store_decide_review_revision((select id from public.store_review_revisions where review_id = review and status = 'pending'), '123', true, 'staff');
$$;

-- --- storage --------------------------------------------------------------------
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'store_review_revisions' and column_name = 'rating'), 'numeric', 'revision ratings are numeric');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'store_review_deletions' and column_name = 'rating'), 'numeric', 'deletion audit ratings are numeric');
select is_empty($$select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'store_%review%' and 'smallint'::regtype = any (p.proargtypes::regtype[])$$, 'no smallint rating overload remains');
select throws_ok($$select * from pg_temp.submit('bad-quarter', 4.25)$$, '23514', null, 'a quarter star is refused');
select throws_ok($$select * from pg_temp.submit('bad-zero', 0)$$, '23514', null, 'zero stars is refused');
select throws_ok($$select * from pg_temp.submit('bad-high', 5.5)$$, '23514', null, 'more than five stars is refused');

-- --- totals -----------------------------------------------------------------------
select ok(pg_temp.approve((select review_id from pg_temp.submit('1', 4.5))), 'a 4.5-star review is approved');
select ok(pg_temp.approve((select review_id from pg_temp.submit('2', 0.5))), 'a half-star review is approved');
select ok(pg_temp.approve((select review_id from pg_temp.submit('3', 3))), 'a whole-star review is approved');
select is(public.store_review_summary('123', array['300']),
  jsonb_build_object('count', 3, 'average', 8::float8 / 3, 'distribution', '{"1": 1, "2": 0, "3": 1, "4": 0, "5": 1}'::jsonb),
  'a half star counts toward the star it fills and the average stays exact');
select is((select (r ->> 'rating')::numeric from public.store_public_reviews('123', array['300'], 50) r where r ->> 'body' = 'Great shirt.' order by (r ->> 'rating')::numeric desc limit 1), 4.5, 'public reviews keep the half star');

select * from finish();
rollback;
