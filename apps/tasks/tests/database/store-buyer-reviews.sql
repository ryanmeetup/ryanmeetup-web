begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.store_buyer_reviews(text,text,integer,timestamptz,uuid,uuid)', 'execute'), 'anonymous clients cannot list a buyer''s reviews');
select ok(not has_function_privilege('authenticated', 'public.store_buyer_reviews(text,text,integer,timestamptz,uuid,uuid)', 'execute'), 'Tasks members cannot list a buyer''s reviews');
select ok(has_function_privilege('service_role', 'public.store_buyer_reviews(text,text,integer,timestamptz,uuid,uuid)', 'execute'), 'the backend can');

create function pg_temp.submit(line text, subject text default 'buyer-a', body text default 'First take.') returns uuid language sql as $$
  select review_id from public.store_submit_review('123', subject, '9000', line, '100', null, 'Name Tag Shirt', 'Black / M', 5::smallint, null, body, 'first-initial', 'Ryan L.');
$$;
create function pg_temp.pending(review uuid) returns uuid language sql as $$
  select id from public.store_review_revisions where review_id = review and status = 'pending';
$$;
create function pg_temp.mine(subject text default 'buyer-a') returns setof jsonb language sql as $$
  select * from public.store_buyer_reviews('123', subject);
$$;
create function pg_temp.status(review uuid) returns text language sql as $$
  select r ->> 'status' from pg_temp.mine() r where (r ->> 'id')::uuid = review;
$$;
create temp table ids (name text primary key, id uuid);

insert into ids values ('pending', pg_temp.submit('1'));
select is(pg_temp.status((select id from ids where name = 'pending')), 'pending', 'a new review shows as waiting');
select is((select r -> 'current' ->> 'body' from pg_temp.mine() r where r ->> 'lineId' = '1'), 'First take.', 'the buyer sees what they wrote');
select is((select count(*) from pg_temp.mine('buyer-b')), 0::bigint, 'another buyer sees none of it');
select is((select count(*) from public.store_buyer_reviews('999', 'buyer-a')), 0::bigint, 'another shop sees none of it');

insert into ids values ('published', pg_temp.submit('2'));
select public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'published')), '123', true, 'staff', 'Looks good');
select is(pg_temp.status((select id from ids where name = 'published')), 'published', 'an approved review shows as published');
select ok((select r ->> 'publishedAt' is not null and not (r ->> 'hasPendingEdit')::boolean from pg_temp.mine() r where r ->> 'lineId' = '2'), 'published with no edit waiting');
select public.store_edit_review((select id from ids where name = 'published'), '123', 'buyer-a', 3::smallint, 'Update', 'Second take.', 'full', 'Ryan Le');
select ok((select (r ->> 'hasPendingEdit')::boolean and r ->> 'status' = 'published' from pg_temp.mine() r where r ->> 'lineId' = '2'), 'an edit waits while the review stays published');
select is((select r -> 'current' from pg_temp.mine() r where r ->> 'lineId' = '2'),
  '{"rating": 3, "title": "Update", "body": "Second take.", "nameStyle": "full", "displayName": "Ryan Le"}'::jsonb, 'the buyer sees their waiting edit');

insert into ids values ('rejected', pg_temp.submit('3'));
select public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'rejected')), '123', false, 'staff', 'Private note');
select is(pg_temp.status((select id from ids where name = 'rejected')), 'rejected', 'a rejected review says so');

insert into ids values ('hidden', pg_temp.submit('4'));
select public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'hidden')), '123', true, 'staff');
select public.store_set_review_hidden((select id from ids where name = 'hidden'), '123', true, 'staff', 'Phone number');
select is(pg_temp.status((select id from ids where name = 'hidden')), 'hidden', 'a hidden review says so');

insert into ids values ('withdrawn', pg_temp.submit('5', body => 'Gone soon.'));
select public.store_withdraw_review((select id from ids where name = 'withdrawn'), '123', 'buyer-a');
select is(pg_temp.status((select id from ids where name = 'withdrawn')), 'withdrawn', 'a withdrawn review says so');
select is((select r -> 'current' ->> 'body' from pg_temp.mine() r where r ->> 'lineId' = '5'), 'Gone soon.', 'a withdrawn review keeps its text for resubmitting');

select is((select count(*) from pg_temp.mine()), 5::bigint, 'every review the buyer wrote is listed');
select is(
  (select array_agg(distinct key order by key) from pg_temp.mine() r, jsonb_object_keys(r) key),
  array['createdAt', 'current', 'hasPendingEdit', 'id', 'item', 'lineId', 'publishedAt', 'status', 'updatedAt'],
  'only buyer-facing fields are returned');
select is((select bool_or(r::text ~ 'Private note|Phone number|staff|buyer-a|9000') from pg_temp.mine() r), false, 'no staff notes, staff names, subject, or order ID leak');

-- The list is bounded and pages by immutable creation order, even when edited.
select ok((select bool_and(r->>'updatedAt' ~ '\.\d{6}Z$' and r->>'createdAt' ~ '\.\d{6}Z$') from pg_temp.mine() r),'private versions keep exact microseconds');
select is((select r->>'id' from public.store_buyer_reviews('123','buyer-a',1,null,null,(select id from ids where name='published')) r),(select id::text from ids where name='published'),'direct scoped reads find one exact review');
select is((select count(*) from public.store_buyer_reviews('123','buyer-b',1,null,null,(select id from ids where name='published'))),0::bigint,'another buyer cannot directly read a known ID');
select is((select array_agg(x order by x) from public.store_buyer_reviewed_lines('123','buyer-a',array['1','2','3','4','5','999']) x),array['1','2','3','4'],'purchase filtering includes pending/rejected/hidden but excludes withdrawal');
select is((select count(*) from public.store_buyer_reviewed_lines('123','buyer-b',array['1','2'])),0::bigint,'purchase filtering is scoped to the buyer');
select is((select count(*) from public.store_buyer_reviewed_lines('999','buyer-a',array['1','2'])),0::bigint,'purchase filtering is scoped to the shop');

create temp table versions (name text primary key, at timestamptz);
insert into versions select 'before-edit',updated_at from public.store_reviews where id=(select id from ids where name='published');
select is(public.store_edit_buyer_review((select id from ids where name='published'),'123','buyer-b',(select at from versions where name='before-edit'),4::smallint,null,'Hijack','anonymous','Anonymous'),'not_found','another buyer cannot edit a known ID');
select is(public.store_edit_buyer_review((select id from ids where name='published'),'123','buyer-a',(select at from versions where name='before-edit'),4::smallint,null,'Latest buyer text.','anonymous','Anonymous'),'pending','a current buyer editor saves a pending revision');
select is(public.store_edit_buyer_review((select id from ids where name='published'),'123','buyer-a',(select at from versions where name='before-edit'),1::smallint,null,'Stale editor','anonymous','Anonymous'),'conflict','an old editor cannot overwrite a newer edit');
select is(public.store_withdraw_buyer_review((select id from ids where name='published'),'123','buyer-a',(select at from versions where name='before-edit')),'conflict','a stale view cannot withdraw changed content');
select is((select r->>'body' from public.store_public_reviews('123',array['100'],50) r where r->>'id'=(select id::text from ids where name='published')),'First take.','buyer editing leaves approved public content unchanged');
select is(public.store_edit_buyer_review((select id from ids where name='hidden'),'123','buyer-a',(select updated_at from public.store_reviews where id=(select id from ids where name='hidden')),5::smallint,null,'Circumvent hide','anonymous','Anonymous'),'closed','a buyer cannot edit around a staff hide');
select is(public.store_withdraw_buyer_review((select id from ids where name='published'),'123','buyer-b',(select updated_at from public.store_reviews where id=(select id from ids where name='published'))),'not_found','another buyer cannot withdraw a known ID');
select is(public.store_withdraw_buyer_review((select id from ids where name='published'),'123','buyer-a',(select updated_at from public.store_reviews where id=(select id from ids where name='published'))),'withdrawn','a current view can withdraw a review');
select is((public.store_review_summary('123',array['100'])->>'count'),'0','withdrawal removes the review from public totals immediately');
select is(public.store_withdraw_buyer_review((select id from ids where name='published'),'123','buyer-a',(select at from versions where name='before-edit')),'withdrawn','an already withdrawn review remains withdrawn without another write');
select is((select count(*) from public.store_review_events where review_id=(select id from ids where name='published') and action='withdrawn'),1::bigint,'an idempotent withdrawal does not create another event');
select is((select r->'current'->>'body' from pg_temp.mine() r where r->>'id'=(select id::text from ids where name='published')),'Latest buyer text.','withdrawn drafts retain the latest submitted content even within one transaction');

-- Audit failures roll back pending replacement, withdrawal, and version together.
insert into ids values ('rollback',pg_temp.submit('901'));
insert into versions select 'rollback',updated_at from public.store_reviews where id=(select id from ids where name='rollback');
create function pg_temp.fail_buyer_audit() returns trigger language plpgsql as $$
  begin
    if new.action in ('edited','withdrawn') and exists(select 1 from public.store_reviews r where r.id=new.review_id and r.line_id='901') then raise exception 'buyer audit unavailable'; end if;
    return new;
  end;
$$;
create trigger fail_buyer_audit before insert on public.store_review_events for each row execute function pg_temp.fail_buyer_audit();
select throws_ok($$select public.store_edit_buyer_review((select id from ids where name='rollback'),'123','buyer-a',(select at from versions where name='rollback'),2::smallint,null,'Cannot save','anonymous','Anonymous')$$,'P0001','buyer audit unavailable','a failed audit rolls back an edit');
select throws_ok($$select public.store_withdraw_buyer_review((select id from ids where name='rollback'),'123','buyer-a',(select at from versions where name='rollback'))$$,'P0001','buyer audit unavailable','a failed audit rolls back withdrawal');
select is((select state from public.store_reviews where id=(select id from ids where name='rollback')),'active','failed withdrawal preserves active state');
select is((select updated_at from public.store_reviews where id=(select id from ids where name='rollback')),(select at from versions where name='rollback'),'failed writes preserve the concurrency token');
select is((select count(*) from public.store_review_revisions where review_id=(select id from ids where name='rollback') and status='pending'),1::bigint,'failed writes leave one original pending revision');

-- More than 100 reviews can be read through successive private pages.
do $$ begin for i in 10..134 loop perform pg_temp.submit(i::text,'pages'); end loop; end $$;
create temp table first_page as select r from public.store_buyer_reviews('123','pages',21) r;
select is((select count(*) from first_page),21::bigint,'one page contains at most 20 rows plus the extra paging row');
select is((select count(*) from first_page p where p.r->>'id' in (select r->>'id' from public.store_buyer_reviews('123','pages',21,((select r from first_page offset 19 limit 1)->>'createdAt')::timestamptz,((select r from first_page offset 19 limit 1)->>'id')::uuid) r)),1::bigint,'the next page shares only the deliberately fetched extra row');
select is((select count(*) from public.store_buyer_reviewed_lines('123','pages',(select array_agg(line_id) from public.store_reviews where customer_subject='pages'))),125::bigint,'purchase filtering remains complete beyond the old 100-review cap');

-- A resubmitted withdrawal is dated by its new approval, not its first one.
insert into ids values ('again', pg_temp.submit('950', body => 'Original.'));
select public.store_decide_review_revision(pg_temp.pending((select id from ids where name='again')),'123',true,'staff',null);
update public.store_reviews set first_published_at = now() - interval '30 days' where id=(select id from ids where name='again');
select public.store_withdraw_review((select id from ids where name='again'),'123','buyer-a');
select is(pg_temp.submit('950', body => 'Back again.'),(select id from ids where name='again'),'resubmitting reuses the withdrawn record');
select ok((select first_published_at is null from public.store_reviews where id=(select id from ids where name='again')),'a resubmission carries no publish date until approved again');
select public.store_decide_review_revision(pg_temp.pending((select id from ids where name='again')),'123',true,'staff',null);
select ok((select first_published_at > now() - interval '1 day' from public.store_reviews where id=(select id from ids where name='again')),'approval gives a resubmission a fresh publish date');

select * from finish();
rollback;
