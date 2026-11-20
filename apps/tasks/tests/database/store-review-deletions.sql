begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- --- access -------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.store_review_deletions'::regclass), 'deletion audit has RLS');
select ok(not has_table_privilege('anon', 'public.store_review_deletions', 'select,insert,update,delete'), 'anon cannot reach the deletion audit');
select ok(not has_table_privilege('authenticated', 'public.store_review_deletions', 'select,insert,update,delete'), 'Tasks members cannot reach the deletion audit');
select ok(has_table_privilege('service_role', 'public.store_review_deletions', 'select,insert'), 'the backend records and reads deletions');
select ok(not has_table_privilege('service_role', 'public.store_review_deletions', 'update'), 'the backend cannot rewrite a deletion');
select ok(not has_table_privilege('service_role', 'public.store_review_deletions', 'delete'), 'the backend cannot erase a deletion');
select is_empty($$select proname::text from pg_proc where pronamespace = 'public'::regnamespace and proname = 'store_delete_review'
  and (prosecdef or has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute') or not has_function_privilege('service_role', oid, 'execute'))$$,
  'deletion is invoker and backend-only');

-- --- fixtures -----------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000911', 'delete-owner@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000912', 'delete-member@example.test', '{}');
set local session_replication_role = replica;
update public.profiles set app_role = 'member', onboarding_completed = true
where id in ('00000000-0000-4000-8000-000000000911', '00000000-0000-4000-8000-000000000912');
update public.profiles set app_role = 'owner' where id = '00000000-0000-4000-8000-000000000911';
set local session_replication_role = origin;

create temp table fixtures(name text primary key, id uuid);
create function pg_temp.photo(buyer text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.store_review_photo_drafts(shop_id, customer_subject, product_id, request_key, sha256, byte_size, width, height, state)
    values ('123', buyer, '100', gen_random_uuid(), repeat('a', 64), 100, 48, 32, 'ready') returning id into v_id;
  insert into storage.objects(bucket_id, name) values ('store-review-photos', '123/' || v_id::text || '.webp');
  return v_id;
end;
$$;
insert into fixtures values ('photo', pg_temp.photo('spam-buyer'));
insert into fixtures select 'spam', review_id from public.store_submit_review_with_photos('123', 'spam-buyer', '910', '1', '100', null,
  'Shirt', null, 5::smallint, 'Buy followers', 'Visit my site for cheap followers.', 'anonymous', 'Anonymous Ryan', array[(select id from fixtures where name = 'photo')]);
insert into fixtures select 'other', review_id from public.store_submit_review('123', 'other-buyer', '911', '1', '100', null,
  'Shirt', null, 2::smallint, 'Shrank', 'Shrank after one wash.', 'anonymous', 'Anonymous Ryan');

create function pg_temp.del(review uuid, reason text default 'spam', note text default null,
  actor uuid default '00000000-0000-4000-8000-000000000911', expected timestamptz default null, shop text default '123')
returns uuid[] language sql as $$
  select public.store_delete_review(actor, shop, review,
    coalesce(expected, (select updated_at from public.store_reviews where id = review)), reason, note);
$$;
grant select on fixtures to service_role;
set local role service_role;

-- --- refusals -------------------------------------------------------------------
select throws_ok($$select pg_temp.del((select id from fixtures where name = 'spam'), actor => '00000000-0000-4000-8000-000000000912')$$,
  '42501', null, 'a regular member cannot delete');
select throws_ok($$select pg_temp.del((select id from fixtures where name = 'spam'), reason => 'low_rating')$$,
  '22023', null, 'an unlisted reason is refused');
select throws_ok($$select pg_temp.del((select id from fixtures where name = 'spam'), reason => null)$$,
  '22023', null, 'a reason is required');
select throws_ok($$select pg_temp.del((select id from fixtures where name = 'spam'), note => ' padded ')$$,
  '22023', null, 'an untrimmed note is refused');
select is(pg_temp.del((select id from fixtures where name = 'spam'), expected => now() - interval '1 day'), null::uuid[], 'a stale view is refused');
select is(pg_temp.del((select id from fixtures where name = 'spam'), shop => '999'), null::uuid[], 'deletion pins the shop');
select is(pg_temp.del(gen_random_uuid()), null::uuid[], 'an unknown review is refused');
select is((select count(*) from public.store_review_deletions), 0::bigint, 'refusals record nothing');

-- --- deletion -------------------------------------------------------------------
select is(pg_temp.del((select id from fixtures where name = 'spam'), note => 'Link spam'),
  array[(select id from fixtures where name = 'photo')], 'deletion returns the photo IDs to remove from storage');
select is((select count(*) from public.store_reviews where id = (select id from fixtures where name = 'spam')), 0::bigint, 'the review is gone');
select is((select count(*) from public.store_review_revisions where review_id = (select id from fixtures where name = 'spam')), 0::bigint, 'its revisions are gone');
select is((select count(*) from public.store_review_events where review_id = (select id from fixtures where name = 'spam')), 0::bigint, 'its events are gone');
select is((select count(*) from public.store_review_photo_drafts where id = (select id from fixtures where name = 'photo')), 0::bigint, 'its photo record is gone');
select is((select count(*) from public.store_reviews where id = (select id from fixtures where name = 'other')), 1::bigint, 'other reviews remain');
select results_eq($$select review_id, product_id, product_title, rating::integer, was_published, verified_purchase, reason, note, photo_count::integer, deleted_by
  from public.store_review_deletions$$,
  $$values ((select id from fixtures where name = 'spam'), '100', 'Shirt', 5, false, true, 'spam', 'Link spam', 1, '00000000-0000-4000-8000-000000000911')$$,
  'the audit row records reason, rating, and actor');
select ok((select bool_and(to_jsonb(d)::text !~ 'spam-buyer|followers|910') from public.store_review_deletions d), 'the audit row holds no review text or buyer identity');
select is(pg_temp.del((select id from fixtures where name = 'other'), reason => 'unrelated'), '{}'::uuid[], 'a review without photos returns an empty list');
select is((select count(*) from public.store_review_deletions), 2::bigint, 'each deletion is recorded once');

select * from finish();
rollback;
