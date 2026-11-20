begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.store_latest_reviews(text)','execute'), 'anonymous clients cannot call the database feed');
select ok(not has_function_privilege('authenticated','public.store_latest_reviews(text)','execute'), 'ordinary members cannot call the database feed');
select ok(has_function_privilege('service_role','public.store_latest_reviews(text)','execute'), 'Store server can read latest reviews');
select ok(not (select prosecdef from pg_proc where oid='public.store_latest_reviews(text)'::regprocedure), 'latest reader cannot elevate its caller');

create temp table latest_fixture(n integer primary key, id uuid);
create function pg_temp.latest_add(n integer, shop text default '123', approve boolean default true) returns uuid language plpgsql as $$
declare rid uuid; revision uuid;
begin
 select review_id into rid from public.store_submit_review(shop,'latest-buyer','800',n::text,
   case when n<=3 then '100' else (100+n)::text end,null,'Fixture product',null,
   case when n=9 then 1::smallint else 5::smallint end,'Latest fixture','Original published body.','anonymous','Anonymous');
 select id into revision from public.store_review_revisions where review_id=rid and status='pending';
 if approve then
  perform public.store_decide_review_revision(revision,shop,true,'fixture-owner');
  update public.store_reviews set first_published_at='2026-11-20T12:00:00Z'::timestamptz+n*interval '1 second' where id=rid;
 end if;
 return rid;
end;$$;
insert into latest_fixture select n,pg_temp.latest_add(n) from generate_series(1,9) n;
insert into latest_fixture values(10,pg_temp.latest_add(10,'123',false)),(99,pg_temp.latest_add(99,'999'));
grant select on latest_fixture to service_role;
set local role service_role;

select is((select count(*) from public.store_latest_reviews('123')),6::bigint,'home feed is capped at six reviews across products');
select is((select value->>'id' from public.store_latest_reviews('123') value limit 1),(select id::text from latest_fixture where n=9),'newest review leads even when it has one star');
select results_eq($$select value->>'id' from public.store_latest_reviews('123') value$$,
 $$select id::text from latest_fixture where n between 4 and 9 order by n desc$$,'all six reviews are newest first across the shop');
select is((select count(*) from public.store_latest_reviews('555')),0::bigint,'another shop never borrows these reviews');
select is_empty($$select value from public.store_latest_reviews('123') value where value->>'id' in (select id::text from latest_fixture where n in (10,99))$$,'pending and foreign-shop reviews stay out');
select is((select value from public.store_latest_reviews('123') value limit 1),
 (select value from public.store_public_reviews('123',array['109'],1) value),'home uses the same approved public projection as product pages');

update public.store_reviews set state='hidden' where id=(select id from latest_fixture where n=9);
select is_empty($$select value from public.store_latest_reviews('123') value where value->>'id'=(select id::text from latest_fixture where n=9)$$,'hiding removes a review on the next read');
select is((select count(*) from public.store_latest_reviews('123')),6::bigint,'older reviews fill a hidden review slot');
select ok(public.store_withdraw_review((select id from latest_fixture where n=8),'123','latest-buyer'),'buyer withdraws review');
select is_empty($$select value from public.store_latest_reviews('123') value where value->>'id'=(select id::text from latest_fixture where n=8)$$,'withdrawn reviews disappear');
delete from public.store_reviews where id=(select id from latest_fixture where n=7);
select is_empty($$select value from public.store_latest_reviews('123') value where value->>'id'=(select id::text from latest_fixture where n=7)$$,'deleted reviews disappear');

select is(public.store_edit_buyer_review((select id from latest_fixture where n=6),'123','latest-buyer',
 (select updated_at from public.store_reviews where id=(select id from latest_fixture where n=6)),2::smallint,'Private edit','Private pending body.','anonymous','Anonymous'),'pending','published review can have a waiting edit');
select is((select value->>'body' from public.store_latest_reviews('123') value where value->>'id'=(select id::text from latest_fixture where n=6)),
 'Original published body.','pending text never leaks into the home showcase');
select ok(public.store_decide_review_revision((select id from public.store_review_revisions where review_id=(select id from latest_fixture where n=6) and status='pending'),'123',false,'fixture-owner','Policy reason'),'reject pending edit');
select is((select value->>'body' from public.store_latest_reviews('123') value where value->>'id'=(select id::text from latest_fixture where n=6)),
 'Original published body.','rejected edits keep the approved body');
select results_eq($$select value->>'id' from public.store_latest_reviews('123') value$$,
 $$select id::text from latest_fixture where n between 1 and 6 order by n desc$$,'same-product reviews are included without duplicates or stale records');

select * from finish();
rollback;
