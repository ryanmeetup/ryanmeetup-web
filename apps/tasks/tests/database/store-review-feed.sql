begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.store_review_feed(text,integer,timestamptz,uuid)','execute'), 'anonymous clients cannot call the review feed');
select ok(not has_function_privilege('authenticated','public.store_review_feed(text,integer,timestamptz,uuid)','execute'), 'ordinary members cannot call the review feed');
select ok(has_function_privilege('service_role','public.store_review_feed(text,integer,timestamptz,uuid)','execute'), 'Store server can read the review feed');
select ok(not (select prosecdef from pg_proc where oid='public.store_review_feed(text,integer,timestamptz,uuid)'::regprocedure), 'feed reader cannot elevate its caller');

create temp table feed_fixture(n integer primary key, id uuid);
create function pg_temp.feed_add(n integer, shop text default '123', approve boolean default true) returns uuid language plpgsql as $$
declare rid uuid; revision uuid;
begin
 select review_id into rid from public.store_submit_review(shop,'feed-buyer','800',n::text,
   case when n<=3 then '100' else (100+n)::text end,null,'Fixture product',null,
   5::smallint,'Feed fixture','Original published body.','anonymous','Anonymous');
 select id into revision from public.store_review_revisions where review_id=rid and status='pending';
 if approve then
  perform public.store_decide_review_revision(revision,shop,true,'fixture-owner');
  update public.store_reviews set first_published_at='2026-11-20T12:00:00Z'::timestamptz+n*interval '1 second' where id=rid;
 end if;
 return rid;
end;$$;
insert into feed_fixture select n,pg_temp.feed_add(n) from generate_series(1,9) n;
insert into feed_fixture values(10,pg_temp.feed_add(10,'123',false)),(99,pg_temp.feed_add(99,'999'));
grant select on feed_fixture to service_role;
set local role service_role;

select results_eq($$select value->>'id' from public.store_review_feed('123',4) value$$,
 $$select id::text from feed_fixture where n between 6 and 9 order by n desc$$,'first page is the newest reviews across the shop');
select results_eq($$select value->>'id' from public.store_review_feed('123',4,
   (select first_published_at from public.store_reviews where id=(select id from feed_fixture where n=6)),(select id from feed_fixture where n=6)) value$$,
 $$select id::text from feed_fixture where n between 2 and 5 order by n desc$$,'the cursor continues across products without gaps');
select results_eq($$select value->>'id' from public.store_review_feed('123',4,
   (select first_published_at from public.store_reviews where id=(select id from feed_fixture where n=2)),(select id from feed_fixture where n=2)) value$$,
 $$select id::text from feed_fixture where n=1$$,'the last page holds what is left, including same-product reviews');
select is((select count(*) from public.store_review_feed('123',500)),9::bigint,'page size is capped and pending reviews stay out');
select is((select count(*) from public.store_review_feed('555',20)),0::bigint,'another shop never borrows these reviews');
select is_empty($$select value from public.store_review_feed('123',50) value where value->>'id' in (select id::text from feed_fixture where n in (10,99))$$,'pending and foreign-shop reviews stay out');
select is((select value from public.store_review_feed('123',1) value),
 (select value from public.store_public_reviews('123',array['109'],1) value),'the feed uses the same approved public projection as product pages');

update public.store_reviews set state='hidden' where id=(select id from feed_fixture where n=9);
select is_empty($$select value from public.store_review_feed('123',50) value where value->>'id'=(select id::text from feed_fixture where n=9)$$,'hiding removes a review on the next read');

select * from finish();
rollback;
