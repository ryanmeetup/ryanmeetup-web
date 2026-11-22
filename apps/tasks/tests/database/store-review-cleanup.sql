begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.store_review_cleanup(text,integer)','execute'), 'anon cannot run review cleanup');
select ok(not has_function_privilege('authenticated','public.store_review_cleanup(text,integer)','execute'), 'Tasks members cannot run review cleanup');
select ok(has_function_privilege('service_role','public.store_review_cleanup(text,integer)','execute'), 'Store server can run review cleanup');
select ok(not (select prosecdef from pg_proc where oid='public.store_review_cleanup(text,integer)'::regprocedure), 'cleanup cannot elevate its caller');

-- Sign-in flows and sessions: only rows a day past expiry go.
insert into public.store_customer_authorizations(state_hash,browser_binding_hash,shop_id,client_id,issuer,redirect_uri,encrypted_flow,created_at,expires_at) values
  (repeat('a',64),repeat('b',64),'123','client','https://shopify.com/authentication/123','https://store.test/api/reviews/auth/callback','v1.test.'||repeat('a',48),now()-interval '2 days',now()-interval '2 days'+interval '10 minutes'),
  (repeat('c',64),repeat('b',64),'123','client','https://shopify.com/authentication/123','https://store.test/api/reviews/auth/callback','v1.test.'||repeat('a',48),now()-interval '1 hour',now()-interval '1 hour'+interval '10 minutes'),
  (repeat('d',64),repeat('b',64),'124','client','https://shopify.com/authentication/124','https://store.test/api/reviews/auth/callback','v1.test.'||repeat('a',48),now()-interval '2 days',now()-interval '2 days'+interval '10 minutes');
insert into public.store_customer_sessions(session_hash,shop_id,client_id,issuer,subject,encrypted_tokens,access_expires_at,expires_at,created_at,revoked_at) values
  (repeat('1',64),'123','client','https://shopify.com/authentication/123','old',null,now()-interval '8 days',now()-interval '2 days',now()-interval '9 days',now()-interval '8 days'),
  (repeat('2',64),'123','client','https://shopify.com/authentication/123','live','v1.test.'||repeat('a',48),now()+interval '1 hour',now()+interval '6 days',now()-interval '1 day',null),
  (repeat('3',64),'123','client','https://shopify.com/authentication/123','revoked',null,now()+interval '1 hour',now()+interval '6 days',now()-interval '1 day',now());

-- Budgets.
insert into public.store_review_photo_budgets(shop_id,customer_subject,window_started_at,attempts) values
  ('123','stale',now()-interval '2 days',3), ('123','fresh',now(),3);
insert into public.store_review_write_budgets(shop_id,bucket,actor,window_started_at,attempts) values
  ('123','submit:buyer','stale',now()-interval '3 days',1), ('123','signin-start:network','fresh',now()-interval '1 day',1);

-- Photos: an expired draft, a live draft, an attached photo a pending edit
-- dropped, an attached photo still on its revision, and a bare orphan object.
insert into public.store_review_photo_drafts(id,shop_id,customer_subject,product_id,request_key,sha256,byte_size,width,height,state,created_at,expires_at) values
  ('00000000-0000-4000-8000-000000000001','123','buyer','100',gen_random_uuid(),repeat('a',64),100,48,32,'ready',now()-interval '3 days',now()-interval '3 days'+interval '1 hour'),
  ('00000000-0000-4000-8000-000000000002','123','buyer','100',gen_random_uuid(),repeat('a',64),100,48,32,'ready',now(),now()+interval '1 hour'),
  ('00000000-0000-4000-8000-000000000003','123','editor','100',gen_random_uuid(),repeat('a',64),100,48,32,'ready',now(),now()+interval '1 hour'),
  ('00000000-0000-4000-8000-000000000004','123','editor','100',gen_random_uuid(),repeat('a',64),100,48,32,'ready',now(),now()+interval '1 hour');
insert into storage.objects(bucket_id,name,created_at) values
  ('store-review-photos','123/00000000-0000-4000-8000-000000000001.webp',now()-interval '3 days'),
  ('store-review-photos','123/00000000-0000-4000-8000-000000000002.webp',now()),
  ('store-review-photos','123/00000000-0000-4000-8000-000000000003.webp',now()),
  ('store-review-photos','123/00000000-0000-4000-8000-000000000004.webp',now()),
  ('store-review-photos','123/00000000-0000-4000-8000-0000000000aa.webp',now()-interval '2 days'),
  ('store-review-photos','123/00000000-0000-4000-8000-0000000000bb.webp',now()),
  ('store-review-photos','124/00000000-0000-4000-8000-0000000000cc.webp',now()-interval '2 days');
select is((select outcome from public.store_submit_review_with_photos('123','editor','900','777','100',null,'Shirt',null,4.5,'Great shirt','Love it','anonymous','Anonymous Ryan',
  array['00000000-0000-4000-8000-000000000003'::uuid,'00000000-0000-4000-8000-000000000004'::uuid])), 'created', 'a review attaches two photos');
delete from public.store_review_revision_photos where photo_id='00000000-0000-4000-8000-000000000004';

create temp table first_run as select public.store_review_cleanup('123') as value;

select ok(exists(select 1 from public.store_customer_authorizations where state_hash=repeat('c',64)), 'an unexpired flow is kept');
select ok(not exists(select 1 from public.store_customer_authorizations where state_hash=repeat('a',64)), 'a flow a day past expiry is deleted');
select ok(exists(select 1 from public.store_customer_authorizations where state_hash=repeat('d',64)), 'another shop''s flows are untouched');
select ok(not exists(select 1 from public.store_customer_sessions where session_hash=repeat('1',64)), 'an expired session is deleted');
select ok(exists(select 1 from public.store_customer_sessions where session_hash=repeat('2',64)), 'a live session is kept');
select ok(exists(select 1 from public.store_customer_sessions where session_hash=repeat('3',64)), 'a revoked session stays until its expiry');
select ok(not exists(select 1 from public.store_review_photo_budgets where customer_subject='stale'), 'a stale upload budget is deleted');
select ok(exists(select 1 from public.store_review_photo_budgets where customer_subject='fresh'), 'a current upload budget is kept');
select ok(not exists(select 1 from public.store_review_write_budgets where actor='stale'), 'a stale write budget is deleted');
select ok(exists(select 1 from public.store_review_write_budgets where actor='fresh'), 'a write budget inside two days is kept');
select is((select value->>'authorizations' from first_run)::integer, 1, 'one flow is counted');
select is((select value->>'sessions' from first_run)::integer, 1, 'one session is counted');

select ok(not exists(select 1 from public.store_review_photo_drafts where id='00000000-0000-4000-8000-000000000001'), 'an expired draft is deleted');
select ok(exists(select 1 from public.store_review_photo_drafts where id='00000000-0000-4000-8000-000000000002'), 'a live draft is kept');
select ok(exists(select 1 from public.store_review_photo_drafts where id='00000000-0000-4000-8000-000000000003'), 'a photo on its revision is kept');
select ok(exists(select 1 from public.store_review_photo_drafts where id='00000000-0000-4000-8000-000000000004'), 'a review edited today keeps a dropped photo');
select set_eq(
  $$select jsonb_array_elements_text(value->'objectPaths') from first_run$$,
  array['123/00000000-0000-4000-8000-000000000001.webp','123/00000000-0000-4000-8000-0000000000aa.webp'],
  'objects are listed for the expired draft and the day-old orphan, never fresh or other-shop objects');
select is((select value->>'orphanObjects' from first_run)::integer, 1, 'the expired draft''s object is not double-counted as an orphan');

-- The Store did not remove those objects (as if removal failed), and the review went quiet.
update public.store_reviews set updated_at=now()-interval '2 days' where customer_subject='editor';
create temp table second_run as select public.store_review_cleanup('123') as value;
select ok(not exists(select 1 from public.store_review_photo_drafts where id='00000000-0000-4000-8000-000000000004'), 'a dropped photo on a quiet review is deleted');
select ok(exists(select 1 from public.store_review_photo_drafts where id='00000000-0000-4000-8000-000000000003'), 'its sibling on the revision survives');
select is((select value->>'unreferencedPhotos' from second_run)::integer, 1, 'the dropped photo is counted');
select set_eq(
  $$select jsonb_array_elements_text(value->'objectPaths') from second_run$$,
  array['123/00000000-0000-4000-8000-000000000004.webp','123/00000000-0000-4000-8000-000000000001.webp','123/00000000-0000-4000-8000-0000000000aa.webp'],
  'objects whose removal failed are listed again');

select is((public.store_review_cleanup('123',1)->>'orphanObjects')::integer, 1, 'the batch limit bounds a backlog');

select throws_ok($$select public.store_review_cleanup('shop')$$, '22023', null, 'a malformed shop is refused');
select throws_ok($$select public.store_review_cleanup('123', 0)$$, '22023', null, 'a zero limit is refused');
select throws_ok($$select public.store_review_cleanup('123', 1001)$$, '22023', null, 'an oversized limit is refused');

select * from finish();
rollback;
