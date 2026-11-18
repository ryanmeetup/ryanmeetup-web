begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- --- access -------------------------------------------------------------------
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.store_reviews'::regclass, 'public.store_review_revisions'::regclass, 'public.store_review_replies'::regclass, 'public.store_review_events'::regclass)), 'every review table has RLS');
select ok(not has_table_privilege('anon', 'public.store_reviews', 'select'), 'anonymous clients cannot read reviews directly');
select ok(not has_table_privilege('authenticated', 'public.store_review_revisions', 'select'), 'Tasks members cannot read drafts');
select ok(not has_table_privilege('authenticated', 'public.store_review_events', 'select'), 'Tasks members cannot read moderation notes');
select ok(not has_table_privilege('authenticated', 'public.store_reviews', 'insert'), 'Tasks members cannot write reviews');
select is_empty($$select p.proname::text from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'store_%review%') and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))$$, 'review functions are backend-only');
select is_empty($$select p.proname::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'store_%review%' and p.prosecdef$$, 'review functions cannot elevate a caller');

-- --- helpers --------------------------------------------------------------------
create function pg_temp.submit(line text, subject text default 'buyer-a', rating smallint default 5, body text default 'Great shirt.', product text default '100', shop text default '123')
returns table (review_id uuid, outcome text) language sql as $$
  select * from public.store_submit_review(shop, subject, '9000', line, product, '200', 'Name Tag Shirt', 'Black / M', rating, null, body, 'first-initial', 'Ryan L.');
$$;
create function pg_temp.pending(review uuid) returns uuid language sql as $$
  select id from public.store_review_revisions where review_id = review and status = 'pending';
$$;
create function pg_temp.public_count(product text default '100', shop text default '123') returns bigint language sql as $$
  select count(*) from public.store_public_reviews(shop, array[product], 50);
$$;
create function pg_temp.summary_count(product text default '100') returns bigint language sql as $$
  select (public.store_review_summary('123', array[product]) ->> 'count')::bigint;
$$;
create temp table ids (name text primary key, id uuid);

-- --- submission ---------------------------------------------------------------
insert into ids select 'a', review_id from pg_temp.submit('1');
select is((select outcome from pg_temp.submit('1')), 'exists', 'a retry reports the existing review instead of a second record');
select is((select review_id from pg_temp.submit('1')), (select id from ids where name = 'a'), 'a retry returns the same review');
select is((select count(*) from public.store_reviews where line_id = '1'), 1::bigint, 'one review per purchased line');
select is((select outcome from pg_temp.submit('1', 'buyer-b')), 'forbidden', 'another account cannot claim the same order line');
select is((select review_id from pg_temp.submit('1', 'buyer-b')), null, 'a refused claim reveals no review id');
select is(pg_temp.public_count(), 0::bigint, 'a pending review is private');
select is(pg_temp.summary_count(), 0::bigint, 'a pending review is not counted');

-- --- moderation and public shape ----------------------------------------------
select ok(public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'a')), '123', true, 'staff@ryanmeetup.com'), 'staff approve a pending review');
select is(pg_temp.public_count(), 1::bigint, 'an approved review is public');
select is(public.store_review_summary('123', array['100']), '{"count": 1, "average": 5, "distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 1}}'::jsonb, 'totals include the approved review');
select is(
  (select array_agg(key order by key) from public.store_public_reviews('123', array['100'], 1) r, jsonb_object_keys(r) key),
  array['body', 'displayName', 'editedAt', 'id', 'item', 'photos', 'publishedAt', 'rating', 'reply', 'title', 'verifiedPurchase'],
  'public reviews carry exactly the contract fields');
select ok((select r ->> 'publishedAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' and r -> 'editedAt' = 'null'::jsonb from public.store_public_reviews('123', array['100'], 1) r), 'dates are ISO UTC and a first approval is not an edit');
select is((select r::text ~ '9000|buyer-a|staff@' from public.store_public_reviews('123', array['100'], 1) r), false, 'no order, customer, or staff detail leaks into the public row');
select is(pg_temp.public_count(shop => '999'), 0::bigint, 'another shop cannot read these reviews');
select ok(not public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'a')), '123', true, 'staff'), 'nothing left to approve');

-- --- edits keep the approved version public ------------------------------------
select is(public.store_edit_review((select id from ids where name = 'a'), '123', 'buyer-a', 4::smallint, 'Update', 'Faded a little after ten washes.', 'full', 'Ryan Le'), 'pending', 'the owner can edit');
select is(public.store_edit_review((select id from ids where name = 'a'), '123', 'buyer-b', 1::smallint, null, 'Hijack', 'full', 'X'), 'not_found', 'another account cannot edit');
select is((select r ->> 'body' from public.store_public_reviews('123', array['100'], 1) r), 'Great shirt.', 'the approved version stays public while an edit waits');
select is(public.store_edit_review((select id from ids where name = 'a'), '123', 'buyer-a', 4::smallint, null, 'Faded a little after ten washes, still love it.', 'full', 'Ryan Le'), 'pending', 'a second edit replaces the first');
select is((select count(*) from public.store_review_revisions where review_id = (select id from ids where name = 'a') and status = 'pending'), 1::bigint, 'only one edit waits at a time');
select throws_ok($$insert into public.store_review_revisions (review_id, rating, body, name_style, display_name) select id, 3, 'x', 'full', 'Ryan' from ids where name = 'a'$$, '23505', null, 'the database refuses a second pending revision');
select ok(public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'a')), '123', true, 'staff'), 'staff approve the edit');
select is((select r ->> 'body' from public.store_public_reviews('123', array['100'], 1) r), 'Faded a little after ten washes, still love it.', 'the approved edit replaces the public text');
select ok((select r ->> 'editedAt' is not null from public.store_public_reviews('123', array['100'], 1) r), 'an approved edit is marked edited');
select is(public.store_review_summary('123', array['100']) ->> 'average', '4', 'totals follow the approved rating');

-- --- rejection, hiding, replies ------------------------------------------------
insert into ids select 'b', review_id from pg_temp.submit('2', rating => 1::smallint, body => 'Too small.');
select ok(public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'b')), '123', false, 'staff', 'Duplicate of an email complaint'), 'staff can reject');
select is(pg_temp.public_count(), 1::bigint, 'a rejected review stays private');
select ok(public.store_set_review_hidden((select id from ids where name = 'a'), '123', true, 'staff', 'Contains a phone number'), 'staff can hide');
select is(pg_temp.public_count(), 0::bigint, 'a hidden review leaves the storefront');
select is(pg_temp.summary_count(), 0::bigint, 'a hidden review leaves the totals');
select is((select outcome from pg_temp.submit('1')), 'exists', 'a buyer cannot resubmit around a hide');
select ok(public.store_set_review_hidden((select id from ids where name = 'a'), '123', false, 'staff'), 'staff can restore');
select is(pg_temp.public_count(), 1::bigint, 'a restored review returns');
select ok(public.store_set_review_reply((select id from ids where name = 'a'), '123', 'Thanks, Ryan!', 'staff'), 'staff can reply');
select ok(public.store_set_review_reply((select id from ids where name = 'a'), '123', 'Thanks so much, Ryan!', 'staff'), 'staff can edit the reply');
select is((select r -> 'reply' ->> 'body' from public.store_public_reviews('123', array['100'], 1) r), 'Thanks so much, Ryan!', 'one reply, shown publicly');
select is((select count(*) from public.store_review_replies), 1::bigint, 'replying twice keeps one reply');
select ok(public.store_set_review_reply((select id from ids where name = 'a'), '123', null, 'staff'), 'staff can remove the reply');
select is((select r -> 'reply' from public.store_public_reviews('123', array['100'], 1) r), 'null'::jsonb, 'a removed reply is gone');

-- --- withdrawal and resubmission -----------------------------------------------
select ok(not public.store_withdraw_review((select id from ids where name = 'a'), '123', 'buyer-b'), 'another account cannot withdraw');
select ok(public.store_withdraw_review((select id from ids where name = 'a'), '123', 'buyer-a'), 'the owner can withdraw');
select is(pg_temp.public_count(), 0::bigint, 'withdrawal removes the review immediately');
select is(pg_temp.summary_count(), 0::bigint, 'withdrawal removes it from the totals');
select is(public.store_edit_review((select id from ids where name = 'a'), '123', 'buyer-a', 5::smallint, null, 'Back again', 'full', 'Ryan Le'), 'closed', 'a withdrawn review cannot be edited');
select ok(not public.store_set_review_reply((select id from ids where name = 'a'), '123', 'Hello?', 'staff'), 'staff cannot reply to a withdrawn review');
select is((select outcome from pg_temp.submit('1', body => 'Changed my mind, it is great.')), 'resubmitted', 'a withdrawn review can be resubmitted on the same line');
select is((select count(*) from public.store_reviews where line_id = '1'), 1::bigint, 'resubmission reuses the record');
select is(pg_temp.public_count(), 0::bigint, 'old text does not reappear before the resubmission is approved');
select ok(public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'a')), '123', true, 'staff'), 'staff approve the resubmission');
select is((select r ->> 'body' from public.store_public_reviews('123', array['100'], 1) r), 'Changed my mind, it is great.', 'the resubmitted text is public');

-- --- paging and scope ------------------------------------------------------------
do $$ declare v_review uuid; begin
  for i in 10..14 loop
    select review_id into v_review from public.store_submit_review('123', 'buyer-' || i, '9000', i::text, '100', null, 'Name Tag Shirt', null, 3::smallint, null, 'Fine.', 'anonymous', 'Anonymous');
    perform public.store_decide_review_revision(
      (select id from public.store_review_revisions where review_id = v_review and status = 'pending'), '123', true, 'staff');
  end loop;
end $$;
select is(pg_temp.summary_count(), 6::bigint, 'totals count every published review, not one page');
select is((select count(*) from public.store_public_reviews('123', array['100'], 4)), 4::bigint, 'pages are bounded');
select is((
  with first_page as (select r from public.store_public_reviews('123', array['100'], 4) r),
  last_row as (select r from first_page offset 3 limit 1)
  select count(*) from last_row, public.store_public_reviews('123', array['100'], 4, (r ->> 'publishedAt')::timestamptz, (r ->> 'id')::uuid)
), 2::bigint, 'the cursor continues where the first page ended');
select is((select count(*) from public.store_public_reviews('123', array['100'], 500)), 6::bigint, 'an oversized page request is capped');
select is(pg_temp.public_count(product => '555'), 0::bigint, 'reviews stay with their own product');
select is((public.store_review_summary('123', array['100', '555']) ->> 'count')::bigint, 6::bigint, 'a deliberate group sums its products');

-- --- constraints -----------------------------------------------------------------
select throws_ok($$select * from pg_temp.submit('50', rating => 6::smallint)$$, '23514', null, 'ratings stop at five stars');
select throws_ok($$select * from pg_temp.submit('51', body => repeat('x', 5001))$$, '23514', null, 'review text has a length limit');
select throws_ok($$select * from pg_temp.submit('52', body => '  padded  ')$$, '23514', null, 'review text must arrive trimmed');
select throws_ok($$select * from pg_temp.submit('53', body => '')$$, '23514', null, 'review text is required');
select throws_ok($$select * from public.store_submit_review('123', 'buyer-a', 'gid://shopify/Order/1', '54', '100', null, 'Shirt', null, 5::smallint, null, 'Hi', 'full', 'Ryan')$$, '23514', null, 'order IDs are stored as plain numbers');
select ok((select count(*) = 0 from public.store_reviews where line_id in ('50', '51', '52', '53')), 'a refused submission leaves no partial review');

-- --- audit ------------------------------------------------------------------------
select is((select array_agg(action order by id) from public.store_review_events where review_id = (select id from ids where name = 'a')),
  array['submitted', 'approved', 'edited', 'edited', 'approved', 'hidden', 'restored', 'reply_set', 'reply_set', 'reply_removed', 'withdrawn', 'resubmitted', 'approved'],
  'every buyer and staff action is recorded in order');
select is((select note from public.store_review_events where action = 'hidden'), 'Contains a phone number', 'moderation notes are kept privately');

select * from finish();
rollback;
