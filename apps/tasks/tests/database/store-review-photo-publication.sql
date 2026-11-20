begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is_empty($$select proname::text from pg_proc where pronamespace='public'::regnamespace
  and proname in ('store_staff_revision_photos','store_review_has_pending_photos','store_pending_review_count','store_review_moderation_page_v5','store_staff_review_photo','store_moderate_review_photo','store_public_review_photo')
  and (prosecdef or has_function_privilege('anon',oid,'execute') or has_function_privilege('authenticated',oid,'execute') or not has_function_privilege('service_role',oid,'execute'))$$,
  'all media functions are invoker and backend-only');
select ok(not (select public from storage.buckets where id='store-review-photos'), 'publication never makes the bucket public');

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000921','media-owner@example.test','{}'),
 ('00000000-0000-4000-8000-000000000922','media-member@example.test','{}');
set local session_replication_role=replica;
update public.profiles set app_role='member',onboarding_completed=true where id in
 ('00000000-0000-4000-8000-000000000921','00000000-0000-4000-8000-000000000922');
update public.profiles set app_role='owner' where id='00000000-0000-4000-8000-000000000921';
set local session_replication_role=origin;
create temp table media_fixture(name text primary key,id uuid);
create function pg_temp.photo() returns uuid language plpgsql as $$
declare p uuid;
begin
 insert into public.store_review_photo_drafts(shop_id,customer_subject,product_id,request_key,sha256,byte_size,width,height,state)
 values('123','media-buyer','100',gen_random_uuid(),repeat('a',64),100,48,32,'ready') returning id into p;
 insert into storage.objects(bucket_id,name) values('store-review-photos','123/'||p::text||'.webp');
 return p;
end;$$;
insert into media_fixture values('one',pg_temp.photo()),('two',pg_temp.photo());
insert into media_fixture select 'review',review_id from public.store_submit_review_with_photos('123','media-buyer','920','1','100',null,
 'Shirt',null,1::smallint,'Runs small','The size ran small.','anonymous','Anonymous',array[(select id from media_fixture where name='one'),(select id from media_fixture where name='two')]);
insert into media_fixture select 'original',id from public.store_review_revisions where review_id=(select id from media_fixture where name='review');
create function pg_temp.decide(p uuid,rev uuid default (null::uuid),action text default 'approve',note text default null,
 actor uuid default '00000000-0000-4000-8000-000000000921',expected timestamptz default null,shop text default '123') returns boolean language sql as $$
 select public.store_moderate_review_photo(actor,shop,(select id from media_fixture where name='review'),
 coalesce(rev,(select id from media_fixture where name='original')),p,
 coalesce(expected,(select updated_at from public.store_reviews where id=(select id from media_fixture where name='review'))),action,note);
$$;
create function pg_temp.public_photo(rev uuid default null) returns jsonb language sql as $$
 select public.store_public_review_photo('123',(select id from media_fixture where name='review'),
 coalesce(rev,(select id from media_fixture where name='original')),(select id from media_fixture where name='one'));
$$;
grant select,insert on media_fixture to service_role;
set local role service_role;

select is(public.store_pending_review_count('00000000-0000-4000-8000-000000000921','123'),1::bigint,'pending count counts reviews, not photos');
select is(jsonb_array_length((select value->'pending'->'photos' from public.store_review_moderation_page_v5('00000000-0000-4000-8000-000000000921','123','pending',null,21) value)),2,'staff queue carries bounded photo metadata');
select is(pg_temp.public_photo(),null::jsonb,'pending text and media are private');
select throws_ok($$select pg_temp.decide((select id from media_fixture where name='one'),actor=>'00000000-0000-4000-8000-000000000922')$$,'42501',null,'a member cannot decide media');
select throws_ok($$select pg_temp.decide((select id from media_fixture where name='one'),action=>'reject')$$,'22023',null,'photo rejection requires a reason');
select throws_ok($$select pg_temp.decide((select id from media_fixture where name='one'),action=>'publish')$$,'22023',null,'unknown decisions are refused');
select is(pg_temp.decide((select id from media_fixture where name='one'),expected=>now()-interval '1 day'),false,'stale media decisions are refused');
select is(pg_temp.decide((select id from media_fixture where name='one'),shop=>'999'),false,'photo decision pins shop');
select is(pg_temp.decide(gen_random_uuid()),false,'unrelated photos are refused');
select is(pg_temp.decide((select id from media_fixture where name='one'),rev=>gen_random_uuid()),false,'unrelated revisions are refused');
select is(pg_temp.decide((select id from media_fixture where name='one')),true,'owner approves one specific photo');
select is(pg_temp.public_photo(),null::jsonb,'photo approval does not approve text');
select ok(public.store_moderate_review('00000000-0000-4000-8000-000000000921','123',(select id from media_fixture where name='review'),
 (select updated_at from public.store_reviews where id=(select id from media_fixture where name='review')),'approve',(select id from media_fixture where name='original'),null),'publish text');
select ok(pg_temp.public_photo() is not null,'approved photo on approved active text is readable');
select is(jsonb_array_length((select value->'photos' from public.store_public_reviews('123',array['100'],20) value)),1,'public projection contains only approved media');
select ok((select value->'photos'->0->>'url' from public.store_public_reviews('123',array['100'],20) value) like '/api/reviews/media/%','public photo uses a Store route, not Storage capability');
select is(public.store_pending_review_count('00000000-0000-4000-8000-000000000921','123'),1::bigint,'undecided photo keeps published review in count');
select is((select count(*) from public.store_review_moderation_page_v5('00000000-0000-4000-8000-000000000921','123','pending',null,21)),1::bigint,'undecided photo keeps published review in waiting queue');
select is(public.store_staff_review_photo('00000000-0000-4000-8000-000000000921','123',(select id from media_fixture where name='review'),
 (select id from media_fixture where name='original'),(select id from media_fixture where name='one'),now()-interval '1 day'),null::jsonb,'old staff preview URLs are revoked');
select ok(public.store_set_review_hidden((select id from media_fixture where name='review'),'123',true,'00000000-0000-4000-8000-000000000921','Policy check'),'hide published review');
select is(pg_temp.public_photo(),null::jsonb,'hiding revokes an already-issued media path');
select ok(public.store_set_review_hidden((select id from media_fixture where name='review'),'123',false,'00000000-0000-4000-8000-000000000921',null),'restore review');
select ok(pg_temp.public_photo() is not null,'restoring restores only approved media');
select is(pg_temp.decide((select id from media_fixture where name='one'),action=>'reject',note=>'Private information'),true,'approved photo can be rejected later');
select is(pg_temp.public_photo(),null::jsonb,'rejecting revokes an already-issued path');
select is(pg_temp.decide((select id from media_fixture where name='one')),true,'a new deliberate approval restores media');
select is(public.store_edit_buyer_review((select id from media_fixture where name='review'),'123','media-buyer',
 (select updated_at from public.store_reviews where id=(select id from media_fixture where name='review')),2::smallint,'Updated','Still small after washing.','anonymous','Anonymous'),'pending','edit published text');
insert into media_fixture select 'edit',id from public.store_review_revisions where review_id=(select id from media_fixture where name='review') and status='pending';
select ok(pg_temp.public_photo() is not null,'pending edits retain the old approved selection');
select is((select moderation_state from public.store_review_revision_photos where revision_id=(select id from media_fixture where name='edit') and photo_id=(select id from media_fixture where name='one')),'pending','retained photos require a new decision for a new revision');
select ok(public.store_moderate_review('00000000-0000-4000-8000-000000000921','123',(select id from media_fixture where name='review'),
 (select updated_at from public.store_reviews where id=(select id from media_fixture where name='review')),'approve',(select id from media_fixture where name='edit'),null),'approve edited text');
select is(pg_temp.public_photo(),null::jsonb,'replaced revision URLs are revoked');
select is(pg_temp.public_photo((select id from media_fixture where name='edit')),null::jsonb,'text approval does not auto-approve retained photos');
select is(pg_temp.decide((select id from media_fixture where name='one'),rev=>(select id from media_fixture where name='edit')),true,'approve retained photo on current edit');
select is(pg_temp.decide((select id from media_fixture where name='two'),rev=>(select id from media_fixture where name='edit'),action=>'reject',note=>'Not relevant'),true,'reject the other current photo');
select is(public.store_pending_review_count('00000000-0000-4000-8000-000000000921','123'),0::bigint,'no pending text or photos remains');
select is((select count(*) from public.store_review_events where photo_id=(select id from media_fixture where name='one') and action='photo_approved'),3::bigint,'photo decisions preserve structured photo/revision/actor audit');
select ok(public.store_withdraw_review((select id from media_fixture where name='review'),'123','media-buyer'),'buyer withdraws review');
select is(pg_temp.public_photo((select id from media_fixture where name='edit')),null::jsonb,'withdrawal revokes media');
select is(pg_temp.decide((select id from media_fixture where name='one'),rev=>(select id from media_fixture where name='edit'),action=>'reject',note=>'No'),false,'withdrawn reviews refuse media decisions');
select is(cardinality(public.store_delete_review('00000000-0000-4000-8000-000000000921','123',(select id from media_fixture where name='review'),
 (select updated_at from public.store_reviews where id=(select id from media_fixture where name='review')),'confidential','Fixture cleanup')),2,'policy deletion also removes all media associations');
select is(pg_temp.public_photo((select id from media_fixture where name='edit')),null::jsonb,'deletion permanently revokes media');
select * from finish();
rollback;
