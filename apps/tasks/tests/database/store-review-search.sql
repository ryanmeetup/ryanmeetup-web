begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.store_public_review_search(text,text[],integer,text,text,text,integer,integer,uuid)','execute'), 'anonymous clients cannot search reviews directly');
select ok(not has_function_privilege('authenticated','public.store_public_review_search(text,text[],integer,text,text,text,integer,integer,uuid)','execute'), 'ordinary members cannot search reviews');
select ok(has_function_privilege('service_role','public.store_public_review_search(text,text[],integer,text,text,text,integer,integer,uuid)','execute'), 'Store server can search reviews');
select ok(not has_function_privilege('anon','public.store_public_review_json(uuid)','execute'), 'anonymous clients cannot read the projection by id');
select ok(not (select prosecdef from pg_proc where oid='public.store_public_review_search(text,text[],integer,text,text,text,integer,integer,uuid)'::regprocedure), 'search cannot elevate its caller');

-- n: 1..8 store reviews (odd verified, even without an order), 9..10 Etsy imports, 11 pending, 12 another shop.
create temp table search_fixture(n integer primary key, id uuid);
create function pg_temp.add(n integer, rating numeric, verified boolean, shop text default '123', approve boolean default true) returns uuid language plpgsql as $$
declare rid uuid; revision uuid;
begin
 select review_id into rid from public.store_submit_review(shop,'search-buyer-'||n,
   case when verified then '800' end, case when verified then n::text end,
   case when n<=4 then '100' else '200' end,null,case when n<=4 then 'Coaster shirt' else 'Name tag mug' end,null,
   rating,'Review '||n, case when n=3 then 'The RYANCOASTER was great.' else 'Plain body.' end,'anonymous','Ryan '||n);
 select id into revision from public.store_review_revisions where review_id=rid and status='pending';
 if approve then
  perform public.store_decide_review_revision(revision,shop,true,'fixture-owner');
  update public.store_reviews set first_published_at='2026-11-20T12:00:00Z'::timestamptz+n*interval '1 second' where id=rid;
 end if;
 return rid;
end;$$;
insert into search_fixture select n, pg_temp.add(n, case when n in (2,5) then 1 when n=4 then 4.5 else 4 end, n % 2 = 1) from generate_series(1,8) n;
insert into search_fixture select 8 + i, review_id from generate_series(1,2) i,
  public.store_import_etsy_review('123', (5154353540+i)::text, '100', 'Coaster shirt', 5, 'Etsy body '||i, 'Etsy Ryan', '2026-11-20T12:00:00Z'::timestamptz+(8+i)*interval '1 second', null, null, null, 'Etsy import');
insert into search_fixture values (11, pg_temp.add(11, 5, true, '123', false)), (12, pg_temp.add(12, 5, true, '999'));
grant select on search_fixture to service_role;
set local role service_role;

create function pg_temp.ids(result jsonb) returns integer[] language sql as $$
  select coalesce(array_agg(f.n order by r.ord), '{}') from jsonb_array_elements(result->'reviews') with ordinality r(value, ord)
  join search_fixture f on f.id::text = r.value->>'id';
$$;
create function pg_temp.search(products text[] default null, rating integer default null, source text default null, sort text default 'newest',
  query text default null, lim integer default 50, start integer default 0, focus uuid default null) returns jsonb language sql as $$
  select public.store_public_review_search('123', products, rating, source, sort, query, lim, start, focus);
$$;

select is(pg_temp.ids(pg_temp.search()), array[10,9,8,7,6,5,4,3,2,1], 'the whole shop, newest first, without pending or foreign reviews');
select is((pg_temp.search()->>'total')::integer, 10, 'the total counts every match');
select is(pg_temp.ids(pg_temp.search(array['100'])), array[10,9,4,3,2,1], 'a product scope reads only that product');

-- pages
select is(pg_temp.ids(pg_temp.search(lim => 4)), array[10,9,8,7], 'the first page');
select is(pg_temp.ids(pg_temp.search(lim => 4, start => 4)), array[6,5,4,3], 'the second page continues without gaps');
select is(pg_temp.search(lim => 4, start => 8) - 'reviews', '{"total":10,"offset":8}'::jsonb, 'the last page says where it starts');
select is(pg_temp.ids(pg_temp.search(lim => 4, start => 8)), array[2,1], 'the last page holds what is left');
select is((pg_temp.search(lim => 4, start => 400)->>'offset')::integer, 8, 'a page past the end serves the last page');
select is(pg_temp.search(rating => 3) , '{"total":0,"offset":0,"reviews":[]}'::jsonb, 'no matches is an empty first page');

-- permalinks
select is((pg_temp.search(lim => 4, focus => (select id from search_fixture where n=2))->>'offset')::integer, 8, 'a focused review serves the page that holds it');
select is((pg_temp.search(lim => 4, start => 4, focus => (select id from search_fixture where n=11))->>'offset')::integer, 4, 'a pending review is never found, so the offset decides');

-- filters
select is(pg_temp.ids(pg_temp.search(rating => 5)), array[10,9,4], 'a star bucket includes the half star below it');
select is(pg_temp.ids(pg_temp.search(rating => 1)), array[5,2], 'one-star reviews');
select is(pg_temp.ids(pg_temp.search(source => 'verified')), array[7,5,3,1], 'verified store purchases');
select is(pg_temp.ids(pg_temp.search(source => 'etsy')), array[10,9], 'Etsy imports');
select is(pg_temp.ids(pg_temp.search(source => 'unmatched')), array[8,6,4,2], 'store reviews without a matching order');
select is(pg_temp.ids(pg_temp.search(rating => 4, source => 'verified')), array[7,3,1], 'filters combine');

-- search
select is(pg_temp.ids(pg_temp.search(query => '  ryanCoaster ')), array[3], 'search ignores case and surrounding space');
select is(pg_temp.ids(pg_temp.search(query => 'name tag')), array[8,7,6,5], 'search matches the product title');
select is(pg_temp.ids(pg_temp.search(query => 'ryan 6')), array[6], 'search matches the reviewer');
select is(pg_temp.ids(pg_temp.search(query => '100%_')), '{}'::integer[], 'search text is literal, not a pattern');

-- sorts break ties newest first, like the storefront always has
select is(pg_temp.ids(pg_temp.search(sort => 'oldest')), array[1,2,3,4,5,6,7,8,9,10], 'oldest first');
select is(pg_temp.ids(pg_temp.search(sort => 'highest')), array[10,9,4,8,7,6,3,1,5,2], 'highest rated, newest first within a rating');
select is(pg_temp.ids(pg_temp.search(sort => 'lowest')), array[5,2,8,7,6,3,1,4,10,9], 'lowest rated, newest first within a rating');

-- one projection for every reader
select is((pg_temp.search(array['100'], lim => 1)->'reviews'->0), (select value from public.store_public_reviews('123', array['100'], 1) value), 'search rows match product page rows');
select is((select count(*) from public.store_review_feed('123', 50)), 10::bigint, 'the feed still reads through the shared projection');

update public.store_reviews set state='hidden' where id=(select id from search_fixture where n=10);
select is(pg_temp.ids(pg_temp.search(lim => 2)), array[9,8], 'hiding removes a review on the next read');

-- invalid requests
select throws_ok($$select pg_temp.search(rating => 6)$$, '22023', 'Invalid review search', 'ratings are star buckets');
select throws_ok($$select pg_temp.search(source => 'shopify')$$, '22023', 'Invalid review search', 'sources are a fixed list');
select throws_ok($$select pg_temp.search(sort => 'random')$$, '22023', 'Invalid review search', 'sorts are a fixed list');
select throws_ok($$select pg_temp.search(start => -1)$$, '22023', 'Invalid review search', 'offsets cannot be negative');
select throws_ok($$select pg_temp.search(query => repeat('r', 201))$$, '22023', 'Invalid review search', 'search text is bounded');
select throws_ok($$select pg_temp.search(array[]::text[])$$, '22023', 'Invalid review search', 'an empty product scope is not the whole shop');

select * from finish();
rollback;
