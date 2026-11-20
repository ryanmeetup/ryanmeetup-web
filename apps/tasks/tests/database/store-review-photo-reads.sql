begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is_empty($$select proname::text from pg_proc where pronamespace='public'::regnamespace
  and proname in ('store_buyer_review_photo_selection','store_get_review_photo_preview')
  and (prosecdef or has_function_privilege('anon',oid,'execute') or has_function_privilege('authenticated',oid,'execute') or not has_function_privilege('service_role',oid,'execute'))$$,
  'private photo reads are invoker and service-only');
create function pg_temp.photo(state text default 'ready') returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.store_review_photo_drafts(shop_id,customer_subject,product_id,request_key,sha256,byte_size,width,height,state)
    values('123','photo-reader','100',gen_random_uuid(),repeat('a',64),100,48,32,state) returning id into v_id;
  insert into storage.objects(bucket_id,name) values('store-review-photos','123/'||v_id::text||'.webp');
  return v_id;
end;
$$;
create temp table fixtures(name text primary key, id uuid);
insert into fixtures values ('first',pg_temp.photo()),('second',pg_temp.photo()),('new',pg_temp.photo()),
  ('uploading',pg_temp.photo('uploading')),('discarded',pg_temp.photo('discarded')),('expired',pg_temp.photo());
update public.store_review_photo_drafts set created_at=created_at-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour'
  where id=(select id from fixtures where name='expired');
select is(public.store_get_review_photo_preview((select id from fixtures where name='first'),'123','photo-reader','100')->>'id',
  (select id::text from fixtures where name='first'),'ready draft is available to its buyer');
select is(public.store_get_review_photo_preview((select id from fixtures where name='first'),'123','other-buyer','100'),null::jsonb,'another buyer cannot preview it');
select is(public.store_get_review_photo_preview((select id from fixtures where name='first'),'124','photo-reader','100'),null::jsonb,'another shop cannot preview it');
select is(public.store_get_review_photo_preview((select id from fixtures where name='first'),'123','photo-reader','101'),null::jsonb,'another product cannot preview it');
select is(public.store_get_review_photo_preview((select id from fixtures where name='uploading'),'123','photo-reader','100'),null::jsonb,'unfinished uploads cannot preview');
select is(public.store_get_review_photo_preview((select id from fixtures where name='discarded'),'123','photo-reader','100'),null::jsonb,'discarded uploads cannot preview');
select is(public.store_get_review_photo_preview((select id from fixtures where name='expired'),'123','photo-reader','100'),null::jsonb,'expired uploads cannot preview');
select is(public.store_get_review_photo_preview(gen_random_uuid(),'123','photo-reader','100'),null::jsonb,'unknown photos have no projection');

insert into fixtures select 'review',review_id from public.store_submit_review_with_photos('123','photo-reader','900','1','100',null,'Shirt',null,
  5::smallint,'Great shirt','Love it','anonymous','Anonymous Ryan',array[(select id from fixtures where name='second'),(select id from fixtures where name='first')]);
select is(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','photo-reader')->'photos',
  (select jsonb_agg(jsonb_build_object('id',id,'width',48,'height',32) order by case name when 'second' then 1 else 2 end) from fixtures where name in ('first','second')),
  'private pending selection preserves explicit photo ordering');
select is((select count(*) from jsonb_object_keys(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','photo-reader'))),4::bigint,
  'selection has only review, product, exact version and references');
select is(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','photo-reader')->>'updatedAt',
  (select public.store_review_staff_time(updated_at) from public.store_reviews where id=(select id from fixtures where name='review')),'selection carries exact review version');
select is(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','other-buyer'),null::jsonb,'foreign review selection is unavailable');
select is(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'124','photo-reader'),null::jsonb,'wrong shop selection is unavailable');
select is(public.store_buyer_review_photo_selection(gen_random_uuid(),'123','photo-reader'),null::jsonb,'unknown review selection is unavailable');
select is((select count(*) from jsonb_object_keys(public.store_get_review_photo_preview((select id from fixtures where name='first'),'123','photo-reader','100'))),6::bigint,
  'server preview context includes only content verification and dimensions');
select ok(not (public.store_get_review_photo_preview((select id from fixtures where name='first'),'123','photo-reader','100') ?| array['customer_subject','shop_id','path','url','request_key','review_id']),
  'preview context excludes identity, paths and capabilities');
update public.store_review_photo_drafts set created_at=created_at-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour'
  where id=(select id from fixtures where name='first');
select is(public.store_get_review_photo_preview((select id from fixtures where name='first'),'123','photo-reader','100')->>'id',
  (select id::text from fixtures where name='first'),'attached selected media outlives draft expiry');
select ok(public.store_decide_review_revision((select id from public.store_review_revisions where review_id=(select id from fixtures where name='review') and status='pending'),'123',true,'staff'), 'approve initial text');
select is(jsonb_array_length(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','photo-reader')->'photos'),2,'approved selection remains privately available');
select is(public.store_edit_buyer_review_with_photos((select id from fixtures where name='review'),'123','photo-reader',
  (select updated_at from public.store_reviews where id=(select id from fixtures where name='review')),4::smallint,'Updated review','Updated body','anonymous','Anonymous Ryan',array[(select id from fixtures where name='new')]),'pending','new selection waits in pending edit');
select is(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','photo-reader')#>>'{photos,0,id}',
  (select id::text from fixtures where name='new'),'pending selection takes precedence over approved');
select is(public.store_get_review_photo_preview((select id from fixtures where name='first'),'123','photo-reader','100'),null::jsonb,'historical photo omitted from current selection cannot preview');
select is(public.store_get_review_photo_preview((select id from fixtures where name='new'),'123','photo-reader','100')->>'id',
  (select id::text from fixtures where name='new'),'current pending photo can preview');
select ok(public.store_decide_review_revision((select id from public.store_review_revisions where review_id=(select id from fixtures where name='review') and status='pending'),'123',false,'staff'),'reject pending text');
select is(jsonb_array_length(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','photo-reader')->'photos'),2,'rejected edit falls back to approved selection like buyer text');
select is(public.store_get_review_photo_preview((select id from fixtures where name='new'),'123','photo-reader','100'),null::jsonb,'rejected edit photo is no longer previewable');
select is(public.store_get_review_photo_preview((select id from fixtures where name='first'),'123','photo-reader','100')->>'id',
  (select id::text from fixtures where name='first'),'approved photo is previewable again');
select ok(public.store_set_review_hidden((select id from fixtures where name='review'),'123',true,'staff'),'hide review');
select is(jsonb_array_length(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','photo-reader')->'photos'),2,'hidden reviews remain privately readable by owner');
select ok(public.store_withdraw_review((select id from fixtures where name='review'),'123','photo-reader'),'withdraw review');
select is(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','photo-reader')#>>'{photos,0,id}',
  (select id::text from fixtures where name='new'),'withdrawn review uses latest buyer attempt by audit order');
select is(public.store_get_review_photo_preview((select id from fixtures where name='new'),'123','photo-reader','100')->>'id',
  (select id::text from fixtures where name='new'),'owner may privately inspect withdrawn latest attempt');
select is(public.store_buyer_review_photo_selection((select id from fixtures where name='review'),'123','other-buyer'),null::jsonb,'withdrawal does not broaden ownership');

insert into fixtures select 'text-only',review_id from public.store_submit_review('123','photo-reader',null,null,'101',null,'Hat',null,5::smallint,'Great hat','Love it','anonymous','Anonymous Ryan');
select is(public.store_buyer_review_photo_selection((select id from fixtures where name='text-only'),'123','photo-reader')->'photos','[]'::jsonb,'owned text-only reviews have an empty selection');
select is((select count(*) from public.store_public_reviews('123',array['100','101'],20)),0::bigint,'private reads do not publish pending or withdrawn text/media');
select * from finish();
rollback;
