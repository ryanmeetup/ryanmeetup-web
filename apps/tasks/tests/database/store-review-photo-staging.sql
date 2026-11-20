begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid = 'public.store_review_photo_drafts'::regclass), 'photo drafts have RLS');
select ok(not has_table_privilege('anon', 'public.store_review_photo_drafts', 'select,insert,update,delete'), 'anonymous clients have no draft table grants');
select ok(not has_table_privilege('authenticated', 'public.store_review_photo_drafts', 'select,insert,update,delete'), 'Tasks members have no draft table grants');
select ok((select bool_and(has_table_privilege('service_role', 'public.store_review_photo_drafts', privilege))
  from unnest(array['select','insert','update','delete']) privilege), 'every service-role grant is explicit');
select is_empty($$select proname::text from pg_proc where pronamespace = 'public'::regnamespace and proname like 'store_%review_photo%'
  and (prosecdef or has_function_privilege('anon',oid,'execute') or has_function_privilege('authenticated',oid,'execute') or not has_function_privilege('service_role',oid,'execute'))$$,
  'photo functions are invoker and backend-only');
select ok((select not public and file_size_limit = 4194304 and allowed_mime_types = array['image/webp'] from storage.buckets where id = 'store-review-photos'), 'the dedicated bucket is private, bounded and WebP only');

create function pg_temp.allocate(key uuid default gen_random_uuid(), subject text default 'buyer-a', product text default '100', shop text default '123', sha text default repeat('a',64))
returns jsonb language sql as $$ select public.store_begin_review_photo(shop,subject,product,key,sha,100,48,32) $$;
create temp table photos (name text primary key, value jsonb);
insert into photos values ('first', pg_temp.allocate('00000000-0000-4000-8000-000000000001'));
select is((select value->>'outcome' from photos where name='first'), 'allocated', 'a slot is allocated');
select is((select value->'photo'->>'state' from photos where name='first'), 'uploading', 'allocation is not ready or public');
select is((select array_agg(key order by key) from photos, jsonb_object_keys(value->'photo') key where name='first'),
  array['byteSize','expiresAt','height','id','productId','sha256','state','width'], 'private staging projection is an exact allowlist');
select ok((select (value->'photo'->>'expiresAt')::timestamptz between clock_timestamp()+interval '59 minutes' and clock_timestamp()+interval '61 minutes' from photos where name='first'), 'new slots expire in one hour');
select is(pg_temp.allocate('00000000-0000-4000-8000-000000000001')->>'outcome', 'exists', 'same request key is idempotent');
select is(pg_temp.allocate('00000000-0000-4000-8000-000000000001',sha=>repeat('b',64))->>'outcome', 'conflict', 'same key cannot change its content');
select is((select count(*) from public.store_review_photo_drafts), 1::bigint, 'retry makes no extra slot');

select is(public.store_get_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-b','100'), null::jsonb, 'other buyer cannot read a known draft ID');
select is(public.store_get_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'999','buyer-a','100'), null::jsonb, 'other shop cannot read it');
select is(public.store_get_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','101'), null::jsonb, 'other product cannot read it');
select ok(not public.store_finish_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-b','100',repeat('a',64)), 'other buyer cannot finish it');
select ok(not public.store_finish_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','100',repeat('b',64)), 'wrong digest cannot finish it');
select ok(public.store_finish_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','100',repeat('a',64)), 'owner can finish its exact digest');
select ok(public.store_finish_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','100',repeat('a',64)), 'finish is idempotent');
select is(public.store_get_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','100')->>'state', 'ready', 'ready is privately readable');

select pg_temp.allocate() from generate_series(1,4);
select is(pg_temp.allocate()->>'outcome', 'full', 'uploading and ready slots share the five-photo bound');
select is(pg_temp.allocate(subject=>'buyer-b')->>'outcome', 'allocated', 'another buyer has a separate bound');
select is(pg_temp.allocate(product=>'101')->>'outcome', 'allocated', 'another product has a separate bound');
select ok(not public.store_discard_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-b','100'), 'other buyer cannot discard a known ID');
select ok(public.store_discard_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','100'), 'owner can discard it');
select ok(public.store_discard_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','100'), 'discard is idempotent for cleanup retry');
select is(public.store_get_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','100'), null::jsonb, 'discarded rows are unavailable');
select ok(not public.store_finish_review_photo((select (value->'photo'->>'id')::uuid from photos where name='first'),'123','buyer-a','100',repeat('a',64)), 'finishing cannot revive discard');
select is(pg_temp.allocate('00000000-0000-4000-8000-000000000001')->>'outcome', 'closed', 'discarded request key is not resurrected');
select is(pg_temp.allocate()->>'outcome', 'allocated', 'discard frees an active slot');
update public.store_review_photo_drafts set created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' where customer_subject='buyer-b';
select is(pg_temp.allocate(subject=>'buyer-b')->>'outcome', 'allocated', 'expired rows do not consume active quota');
select ok(not public.store_finish_review_photo((select id from public.store_review_photo_drafts where customer_subject='buyer-b' and expires_at<clock_timestamp() limit 1),'123','buyer-b','100',repeat('a',64)), 'expired slots cannot finish');

select throws_ok($$select public.store_begin_review_photo('123','buyer-a','100',gen_random_uuid(),repeat('a',64),4194305,48,32)$$,'22023','Invalid photo staging request','byte size is bounded');
select throws_ok($$select public.store_begin_review_photo('123','buyer-a','100',gen_random_uuid(),repeat('a',64),100,2049,32)$$,'22023','Invalid photo staging request','dimensions are bounded');
select throws_ok($$select public.store_begin_review_photo('123','buyer-a','100',null,repeat('a',64),100,48,32)$$,'22023','Invalid photo staging request','null idempotency key is rejected');
select throws_ok($$select public.store_begin_review_photo('123','buyer-a','100',gen_random_uuid(),'private-content',100,48,32)$$,'22023','Invalid photo staging request','digest must have the canonical shape');

set local role service_role;
select is(pg_temp.allocate(subject=>'service-buyer')->>'outcome','allocated','service role can allocate a scoped draft');
select ok(public.store_finish_review_photo((select id from public.store_review_photo_drafts where customer_subject='service-buyer'),'123','service-buyer','100',repeat('a',64)),'service role can finish its scoped draft');
select ok(public.store_discard_review_photo((select id from public.store_review_photo_drafts where customer_subject='service-buyer'),'123','service-buyer','100'),'service role can discard its scoped draft');
set local role postgres;

-- Even a permissive policy/table grant must not open this bucket to browser roles.
grant select,insert,update,delete on storage.objects to anon,authenticated;
create policy photo_test_permissive on storage.objects for all to anon,authenticated using(true) with check(true);
insert into storage.objects (bucket_id,name) values ('store-review-photos','123/private-test.webp'),('instance-assets','unrelated-test.webp');
set local role anon;
select is((select count(*) from storage.objects where bucket_id='store-review-photos'),0::bigint,'anonymous reads stay denied despite a permissive policy');
select is((select count(*) from storage.objects where name='unrelated-test.webp'),1::bigint,'unrelated buckets retain their existing policy behavior');
select throws_ok($$insert into storage.objects(bucket_id,name) values('store-review-photos','anonymous.webp')$$,'42501',null,'anonymous writes stay denied');
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id='store-review-photos'),0::bigint,'Tasks-member reads stay denied');
select throws_ok($$insert into storage.objects(bucket_id,name) values('store-review-photos','member.webp')$$,'42501',null,'Tasks-member writes stay denied');
set local role postgres;
select is((select count(*) from public.store_reviews),0::bigint,'staging creates no reviews');
select * from finish();
rollback;
