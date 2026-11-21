begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- --- access -------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.store_import_etsy_review(text,text,text,text,numeric,text,text,timestamptz,text,timestamptz,uuid[],text)', 'execute'), 'anonymous clients cannot import reviews');
select ok(not has_function_privilege('authenticated', 'public.store_import_etsy_review(text,text,text,text,numeric,text,text,timestamptz,text,timestamptz,uuid[],text)', 'execute'), 'Tasks members cannot import reviews');
select ok(has_function_privilege('service_role', 'public.store_import_etsy_review(text,text,text,text,numeric,text,text,timestamptz,text,timestamptz,uuid[],text)', 'execute'), 'the Store backend can import reviews');

create function pg_temp.import(etsy text, product text default '100', reply text default null, photos uuid[] default null)
returns table (review_id uuid, outcome text) language sql as $$
  select * from public.store_import_etsy_review('123', etsy, product, 'Ryan Coaster Shirt', 5, 'Great shirt to remember the Ryancoaster!',
    'Cindy', '2026-08-20T00:00:00Z', reply, case when reply is null then null else '2026-08-21T00:00:00Z'::timestamptz end, photos, 'Etsy import');
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to service_role;
set local role service_role;

-- --- import -------------------------------------------------------------------
insert into ids select 'a', review_id from pg_temp.import('5154353544', reply => 'Thanks Cindy!');
select is((select outcome from pg_temp.import('5154353544')), 'exists', 're-running the import reports the existing review');
select is((select count(*) from public.store_reviews where source_review_id = '5154353544'), 1::bigint, 'one review per Etsy review');
select is((select r ->> 'source' from public.store_public_reviews('123', array['100'], 1) r), 'etsy', 'the public row says where the review came from');
select is((select r -> 'title' from public.store_public_reviews('123', array['100'], 1) r), 'null'::jsonb, 'an imported review has no title');
select is((select (r ->> 'verifiedPurchase')::boolean from public.store_public_reviews('123', array['100'], 1) r), false, 'no store order is claimed for it');
select is((select r ->> 'publishedAt' from public.store_public_reviews('123', array['100'], 1) r), '2026-08-20T00:00:00.000Z', 'it keeps the date it was left on Etsy');
select is((select r -> 'reply' ->> 'body' from public.store_public_reviews('123', array['100'], 1) r), 'Thanks Cindy!', 'its reply comes with it');
select is((select r::text ~ 'etsy:|Etsy import' from public.store_public_reviews('123', array['100'], 1) r), false, 'no import subject or actor leaks into the public row');
select is((public.store_review_summary('123', array['100']) ->> 'count')::integer, 1, 'it counts toward the product total');
select is((select count(*) from public.store_review_feed('123', 20)), 1::bigint, 'it appears in the shop-wide feed');
select is((select action from public.store_review_events where review_id = (select id from ids where name = 'a')), 'imported', 'the audit trail records the import');

-- An Etsy-only listing is stored under its listing id and appears only in the feed.
select is((select outcome from pg_temp.import('4376502612', product => '1623994825')), 'created', 'a listing that never came to the store is still imported');
select is((select count(*) from public.store_review_feed('123', 20)), 2::bigint, 'the feed shows it');

-- --- a buyer never owns an imported review ------------------------------------
select ok(not public.store_withdraw_review((select id from ids where name = 'a'), '123', 'gid://shopify/Customer/1'), 'a buyer cannot withdraw an imported review');
select is((select count(*) from public.store_buyer_reviewed_products('123', 'gid://shopify/Customer/1', array['100'])), 0::bigint, 'it never counts as a buyer''s review');

-- --- photos -------------------------------------------------------------------
create temp table photo as select (public.store_begin_review_photo('123', 'etsy:5142562065', '100', gen_random_uuid(), repeat('a', 64), 1000, 640, 640) -> 'photo' ->> 'id')::uuid id;
select ok(public.store_finish_review_photo((select id from photo), '123', 'etsy:5142562065', '100', repeat('a', 64)), 'a photo is staged under the imported review''s subject');
select throws_ok($$select * from pg_temp.import('5142562065', photos => array[gen_random_uuid()])$$, '22023', null, 'an unstaged photo is refused');
select is((select outcome from pg_temp.import('5142562065', photos => array[(select id from photo)])), 'created', 'a staged photo is attached on import');
select is((select jsonb_array_length(r -> 'photos') from public.store_public_reviews('123', array['100'], 50) r where r ->> 'id' = (select id::text from public.store_reviews where source_review_id = '5142562065')), 1, 'the photo is published with the review');

-- --- titles stay required on the store ----------------------------------------
select throws_ok($$select * from public.store_submit_review('123', 'gid://shopify/Customer/2', null, null, '100', null, 'Shirt', null, 5, null, 'No title', 'full', 'Ryan')$$,
  '23502', null, 'a store review still needs a title');
select throws_ok($$insert into public.store_reviews (shop_id, customer_subject, product_id, product_title, source, source_review_id) values ('123', 'gid://shopify/Customer/3', '100', 'Shirt', 'etsy', '1')$$,
  '23514', null, 'an imported review must use its own etsy subject');
select throws_ok($$select * from pg_temp.import('not-a-number')$$, '22023', null, 'an Etsy review id is numeric');

select * from finish();
rollback;
