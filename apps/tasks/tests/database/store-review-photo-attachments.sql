begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid='public.store_review_revision_photos'::regclass), 'revision photos have RLS');
select ok((select relrowsecurity from pg_class where oid='public.store_review_photo_budgets'::regclass), 'upload budgets have RLS');
select ok(not has_table_privilege('anon','public.store_review_revision_photos','select,insert,update,delete'), 'anon cannot reach revision photos');
select ok(not has_table_privilege('authenticated','public.store_review_revision_photos','select,insert,update,delete'), 'Tasks members cannot reach revision photos');
select ok(not has_table_privilege('anon','public.store_review_photo_budgets','select,insert,update,delete'), 'anon cannot reach budgets');
select ok(not has_table_privilege('authenticated','public.store_review_photo_budgets','select,insert,update,delete'), 'Tasks members cannot reach budgets');
select is_empty($$select proname::text from pg_proc where pronamespace='public'::regnamespace
  and proname in ('store_consume_review_photo_budget','store_attach_review_photos','store_submit_review_with_photos','store_edit_buyer_review_with_photos')
  and (prosecdef or has_function_privilege('anon',oid,'execute') or has_function_privilege('authenticated',oid,'execute') or not has_function_privilege('service_role',oid,'execute'))$$,
  'attachment and budget functions are invoker and backend-only');
select is((select count(*) from generate_series(1,30) where (public.store_consume_review_photo_budget('123','budget-buyer')->>'allowed')::boolean),30::bigint,'first thirty attempts allowed');
select is(public.store_consume_review_photo_budget('123','budget-buyer')->>'allowed','false','attempt thirty-one denied');
select ok((public.store_consume_review_photo_budget('123','budget-buyer')->>'retryAfter')::integer between 1 and 600,'denial includes bounded retry');
select is(public.store_consume_review_photo_budget('123','another-buyer')->>'allowed','true','budget is buyer scoped');
select is(public.store_consume_review_photo_budget('124','budget-buyer')->>'allowed','true','budget is shop scoped');
update public.store_review_photo_budgets set window_started_at=clock_timestamp()-interval '11 minutes' where customer_subject='budget-buyer';
select is(public.store_consume_review_photo_budget('123','budget-buyer')->>'allowed','true','expired budget resets');
select is((select attempts::integer from public.store_review_photo_budgets where shop_id='123' and customer_subject='budget-buyer'),1,'reset begins at one');

create function pg_temp.photo(buyer text default 'photo-buyer', product text default '100', state text default 'ready', stored boolean default true) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.store_review_photo_drafts(shop_id,customer_subject,product_id,request_key,sha256,byte_size,width,height,state)
    values('123',buyer,product,gen_random_uuid(),repeat('a',64),100,48,32,state) returning id into v_id;
  if stored then insert into storage.objects(bucket_id,name) values('store-review-photos','123/'||v_id::text||'.webp'); end if;
  return v_id;
end;
$$;
create temp table fixtures(name text primary key, id uuid);
insert into fixtures values ('photo',pg_temp.photo()),('foreign',pg_temp.photo('other-buyer')),('product',pg_temp.photo(product=>'101')),('uploading',pg_temp.photo(state=>'uploading')),('expired',pg_temp.photo());
update public.store_review_photo_drafts set expires_at=created_at+interval '1 second', created_at=created_at-interval '2 hours' where id=(select id from fixtures where name='expired');
-- Make expiry unambiguously past while retaining the table's creation/expiry constraint.
update public.store_review_photo_drafts set expires_at=clock_timestamp()-interval '1 hour' where id=(select id from fixtures where name='expired');
create function pg_temp.submit(line text, photos uuid[]) returns table(review_id uuid,outcome text) language sql as $$
  select * from public.store_submit_review_with_photos('123','photo-buyer','900',line,'100',null,'Shirt',null,5::smallint,'Great shirt','Love it','anonymous','Anonymous Ryan',photos);
$$;
select is((select outcome from pg_temp.submit('1',array[(select id from fixtures where name='foreign')])),'invalid_photos','another buyer photo refused');
select is((select count(*) from public.store_reviews where customer_subject='photo-buyer'),0::bigint,'failed attachment rolls back new review');
select is((select count(*) from public.store_review_events where actor='photo-buyer'),0::bigint,'failed attachment rolls back audit');
select is((select outcome from pg_temp.submit('1',array[(select id from fixtures where name='product')])),'invalid_photos','other product refused');
select is((select outcome from pg_temp.submit('1',array[(select id from fixtures where name='uploading')])),'invalid_photos','unfinished upload refused');
select is((select outcome from pg_temp.submit('1',array[(select id from fixtures where name='expired')])),'invalid_photos','expired draft refused');
select is((select outcome from pg_temp.submit('1',array[gen_random_uuid()])),'invalid_photos','unknown draft refused');
select is((select outcome from pg_temp.submit('1',array[(select id from fixtures where name='photo'),(select id from fixtures where name='photo')])),'invalid_photos','duplicate draft refused');
select is((select outcome from pg_temp.submit('1',array[null::uuid])),'invalid_photos','null draft refused');
select is((select outcome from pg_temp.submit('1',array[]::uuid[]||array_fill(gen_random_uuid(),array[6]))),'invalid_photos','six drafts refused');
insert into fixtures select 'review',review_id from pg_temp.submit('1',array[(select id from fixtures where name='photo')]);
select is((select state from public.store_review_photo_drafts where id=(select id from fixtures where name='photo')),'attached','successful submit claims draft');
select is((select count(*) from public.store_review_revision_photos where photo_id=(select id from fixtures where name='photo')),1::bigint,'photo belongs to pending revision');
select is((select moderation_state from public.store_review_revision_photos where photo_id=(select id from fixtures where name='photo')),'pending','media starts pending');
select ok(not public.store_discard_review_photo((select id from fixtures where name='photo'),'123','photo-buyer','100'),'attached photo cannot be discarded');
select is(public.store_get_review_photo((select id from fixtures where name='photo'),'123','photo-buyer','100'),null::jsonb,'attached photo no longer returned by draft API');
select is((select outcome from pg_temp.submit('2',array[(select id from fixtures where name='photo')])),'invalid_photos','same photo cannot belong to another review');
select is((select outcome from pg_temp.submit('1',array[(select id from fixtures where name='foreign')])),'exists','duplicate submission stays idempotent without changing photos');

create temp table before_edit as select r.id,r.updated_at,v.id as revision_id from public.store_reviews r join public.store_review_revisions v on v.review_id=r.id and v.status='pending' where r.id=(select id from fixtures where name='review');
select is(public.store_edit_buyer_review_with_photos((select id from before_edit),'123','photo-buyer',(select updated_at from before_edit),4::smallint,'New title','New body','anonymous','Anonymous Ryan',array[(select id from fixtures where name='foreign')]),'invalid_photos','bad edit photo refused');
select ok((select r.updated_at=b.updated_at from public.store_reviews r join before_edit b on b.id=r.id),'failed edit preserves exact version');
select is((select id from public.store_review_revisions where review_id=(select id from before_edit) and status='pending'),(select revision_id from before_edit),'failed edit preserves pending text');
select is((select count(*) from public.store_review_events where actor='photo-buyer' and action='edited'),0::bigint,'failed edit audit rolled back');
select is(public.store_edit_buyer_review((select id from before_edit),'123','photo-buyer',(select updated_at from before_edit),4::smallint,'New title','New body','anonymous','Anonymous Ryan'),'pending','text-only edit succeeds');
select is((select count(*) from public.store_review_revision_photos p join public.store_review_revisions v on v.id=p.revision_id where v.review_id=(select id from before_edit) and v.status='pending'),1::bigint,'text-only edit retains photo');
select is(public.store_edit_buyer_review_with_photos((select id from before_edit),'123','photo-buyer',(select updated_at from before_edit),4::smallint,'Stale title','New body','anonymous','Anonymous Ryan',array[]::uuid[]),'conflict','stale version cannot alter selection');
select is(public.store_edit_buyer_review_with_photos((select id from before_edit),'123','photo-buyer',(select updated_at from public.store_reviews where id=(select id from before_edit)),4::smallint,'Remove photo','New body','anonymous','Anonymous Ryan',array[]::uuid[]),'pending','explicit empty selection removes photo from new revision');
select is((select count(*) from public.store_review_revision_photos p join public.store_review_revisions v on v.id=p.revision_id where v.review_id=(select id from before_edit) and v.status='pending'),0::bigint,'new revision has no photos');
select ok(not public.store_discard_review_photo((select id from fixtures where name='photo'),'123','photo-buyer','100'),'historical photo stays protected after removal');
select is(public.store_edit_buyer_review_with_photos((select id from before_edit),'123','photo-buyer',(select updated_at from public.store_reviews where id=(select id from before_edit)),4::smallint,'Retain photo','New body','anonymous','Anonymous Ryan',array[(select id from fixtures where name='photo')]),'pending','same review may reuse its historical photo');
select ok(public.store_decide_review_revision((select id from public.store_review_revisions where review_id=(select id from before_edit) and status='pending'),'123',true,'staff',null),'text approval succeeds');
select is((select moderation_state from public.store_review_revision_photos p join public.store_review_revisions v on v.id=p.revision_id where v.review_id=(select id from before_edit) and v.status='approved'),'pending','text approval does not approve media');
select is((select value->'photos' from public.store_public_reviews('123',array['100'],20) value),'[]'::jsonb,'public projection still exposes no media');
-- An approved set remains unchanged while a newer photo selection waits.
insert into fixtures values ('new-photo',pg_temp.photo());
select is(public.store_edit_buyer_review_with_photos((select id from before_edit),'123','photo-buyer',(select updated_at from public.store_reviews where id=(select id from before_edit)),4::smallint,'New photo','New body','anonymous','Anonymous Ryan',array[(select id from fixtures where name='new-photo')]),'pending','new photos wait on a pending edit');
select is((select p.photo_id from public.store_review_revision_photos p join public.store_review_revisions v on v.id=p.revision_id where v.review_id=(select id from before_edit) and v.status='approved'),(select id from fixtures where name='photo'),'approved revision retains its earlier photo');
select is((select p.photo_id from public.store_review_revision_photos p join public.store_review_revisions v on v.id=p.revision_id where v.review_id=(select id from before_edit) and v.status='pending'),(select id from fixtures where name='new-photo'),'pending revision owns only new selection');
select is(public.store_begin_review_photo('123','photo-buyer','100',(select request_key from public.store_review_photo_drafts where id=(select id from fixtures where name='new-photo')),repeat('a',64),100,48,32)->>'outcome','closed','attached request keys cannot revive');
select is((select value->'photos' from public.store_public_reviews('123',array['100'],20) value),'[]'::jsonb,'pending media stays outside public reads');
insert into fixtures values ('missing-object',pg_temp.photo(stored=>false));
select is((select outcome from pg_temp.submit('3',array[(select id from fixtures where name='missing-object')])),'invalid_photos','missing stored object prevents attachment');
insert into fixtures values ('discarded-photo',pg_temp.photo());
select ok(public.store_discard_review_photo((select id from fixtures where name='discarded-photo'),'123','photo-buyer','100'),'unattached draft may be discarded');
select is((select outcome from pg_temp.submit('3',array[(select id from fixtures where name='discarded-photo')])),'invalid_photos','discarded draft cannot attach');
select * from finish();
rollback;
