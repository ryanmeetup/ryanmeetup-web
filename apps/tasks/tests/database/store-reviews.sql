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
  select * from public.store_submit_review(shop, subject, '9000', line, product, '200', 'Name Tag Shirt', 'Black / M', rating, 'Solid', body, 'first-initial', 'Ryan L.');
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
select is(public.store_edit_review((select id from ids where name = 'a'), '123', 'buyer-b', 1::smallint, 'Solid', 'Hijack', 'full', 'X'), 'not_found', 'another account cannot edit');
select is((select r ->> 'body' from public.store_public_reviews('123', array['100'], 1) r), 'Great shirt.', 'the approved version stays public while an edit waits');
select is(public.store_edit_review((select id from ids where name = 'a'), '123', 'buyer-a', 4::smallint, 'Solid', 'Faded a little after ten washes, still love it.', 'full', 'Ryan Le'), 'pending', 'a second edit replaces the first');
select is((select count(*) from public.store_review_revisions where review_id = (select id from ids where name = 'a') and status = 'pending'), 1::bigint, 'only one edit waits at a time');
select throws_ok($$insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name) select id, 3, 'x', 'x', 'full', 'Ryan' from ids where name = 'a'$$, '23505', null, 'the database refuses a second pending revision');
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
select is(public.store_edit_review((select id from ids where name = 'a'), '123', 'buyer-a', 5::smallint, 'Solid', 'Back again', 'full', 'Ryan Le'), 'closed', 'a withdrawn review cannot be edited');
select ok(not public.store_set_review_reply((select id from ids where name = 'a'), '123', 'Hello?', 'staff'), 'staff cannot reply to a withdrawn review');
select is((select outcome from pg_temp.submit('1', body => 'Changed my mind, it is great.')), 'resubmitted', 'a withdrawn review can be resubmitted on the same line');
select is((select count(*) from public.store_reviews where line_id = '1'), 1::bigint, 'resubmission reuses the record');
select is(pg_temp.public_count(), 0::bigint, 'old text does not reappear before the resubmission is approved');
select ok(public.store_decide_review_revision(pg_temp.pending((select id from ids where name = 'a')), '123', true, 'staff'), 'staff approve the resubmission');
select is((select r ->> 'body' from public.store_public_reviews('123', array['100'], 1) r), 'Changed my mind, it is great.', 'the resubmitted text is public');

-- --- paging and scope ------------------------------------------------------------
do $$ declare v_review uuid; begin
  for i in 10..14 loop
    select review_id into v_review from public.store_submit_review('123', 'buyer-' || i, '9000', i::text, '100', null, 'Name Tag Shirt', null, 3::smallint, 'Solid', 'Fine.', 'anonymous', 'Anonymous');
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
select throws_ok($$select * from public.store_submit_review('123', 'buyer-a', '9000', '55', '100', null, 'Shirt', null, 5::smallint, null, 'Hi', 'full', 'Ryan')$$, '23502', null, 'a review title is required');
select throws_ok($$select * from public.store_submit_review('123', 'buyer-a', 'gid://shopify/Order/1', '54', '100', null, 'Shirt', null, 5::smallint, 'Solid', 'Hi', 'full', 'Ryan')$$, '23514', null, 'order IDs are stored as plain numbers');
select ok((select count(*) = 0 from public.store_reviews where line_id in ('50', '51', '52', '53')), 'a refused submission leaves no partial review');

-- --- audit ------------------------------------------------------------------------
select is((select array_agg(action order by id) from public.store_review_events where review_id = (select id from ids where name = 'a')),
  array['submitted', 'approved', 'edited', 'edited', 'approved', 'hidden', 'restored', 'reply_set', 'reply_set', 'reply_removed', 'withdrawn', 'resubmitted', 'approved'],
  'every buyer and staff action is recorded in order');
select is((select note from public.store_review_events where action = 'hidden'), 'Contains a phone number', 'moderation notes are kept privately');

-- --- authenticated owner moderation boundary --------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000901', 'review-owner@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000902', 'review-member@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000903', 'review-incomplete@example.test', '{}');
set local session_replication_role = replica;
update public.profiles set app_role = 'member', onboarding_completed = true
where id in ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000902');
update public.profiles set app_role = 'owner' where id in ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000903');
set local session_replication_role = origin;
create function pg_temp.moderate(review uuid, action text, revision uuid default null, note text default null, expected timestamptz default null)
returns boolean language sql as $$
  select public.store_moderate_review('00000000-0000-4000-8000-000000000901', '345', review,
    coalesce(expected, (select updated_at from public.store_reviews where id = review)), action, revision, note);
$$;
create function pg_temp.queue(filter text default 'pending') returns setof jsonb language sql as $$
  select * from public.store_review_moderation_page('00000000-0000-4000-8000-000000000901', '345', filter, 21);
$$;
grant select, insert, update on ids to service_role;
set local role service_role;
select lives_ok($$select public.store_require_review_owner('00000000-0000-4000-8000-000000000901')$$, 'the backend can use a current app owner');
select throws_ok($$select public.store_require_review_owner('00000000-0000-4000-8000-000000000902')$$, '42501', null, 'a regular member cannot moderate');
select throws_ok($$select public.store_require_review_owner('00000000-0000-4000-8000-000000000903')$$, '42501', null, 'an incomplete owner cannot moderate');
select throws_ok($$select public.store_require_review_owner(null)$$, '42501', null, 'a missing actor cannot moderate');
select throws_ok($$select * from public.store_review_moderation_page('00000000-0000-4000-8000-000000000902', '345', 'pending', 21)$$, '42501', null, 'private queue reads also recheck the actor');
insert into ids select 'mod-low', review_id from pg_temp.submit('801', rating => 1::smallint, shop => '345');
insert into ids select 'mod-high', review_id from pg_temp.submit('802', shop => '345');
update public.store_reviews set created_at = now() - interval '1 day' where id = (select id from ids where name = 'mod-low');
select is((select count(*) from pg_temp.queue()), 2::bigint, 'the queue includes low and high ratings');
select is((select r->>'id' from pg_temp.queue() r limit 1), (select id::text from ids where name = 'mod-low'), 'oldest first, independent of rating');
select is((select count(*) from public.store_review_moderation_page('00000000-0000-4000-8000-000000000901', '999', 'all', 21)), 0::bigint, 'staff reads pin the shop');
select ok((select bool_and(r::text !~ 'customer_subject|buyer-a|order_id|9000') from pg_temp.queue() r), 'staff queue omits order and buyer identity');
select is((select count(*) from public.store_review_moderation_page('00000000-0000-4000-8000-000000000901', '345', 'all', 21,
  (select created_at from public.store_reviews where id = (select id from ids where name = 'mod-low')), (select id from ids where name = 'mod-low'))), 1::bigint, 'keyset paging excludes the cursor and retains the next row');
select ok(not pg_temp.moderate((select id from ids where name = 'mod-low'), 'approve', pg_temp.pending((select id from ids where name = 'mod-high'))), 'a revision from another review cannot be approved');
select ok(not pg_temp.moderate((select id from ids where name = 'mod-low'), 'approve', pg_temp.pending((select id from ids where name = 'mod-low')), expected => now() - interval '1 day'), 'a stale review version is refused');
select throws_ok($$select pg_temp.moderate((select id from ids where name = 'mod-low'), 'reject', pg_temp.pending((select id from ids where name = 'mod-low')))$$, '22023', null, 'rejection requires a private reason');
select ok(pg_temp.moderate((select id from ids where name = 'mod-low'), 'approve', pg_temp.pending((select id from ids where name = 'mod-low'))), 'an owner publishes a one-star review');
select is((public.store_review_summary('345', array['100'])->>'average'), '1', 'the published low rating contributes to totals');
select is((select count(*) from pg_temp.queue('published')), 1::bigint, 'published filter shows the live review');
select is(public.store_edit_review((select id from ids where name = 'mod-low'), '345', 'buyer-a', 2::smallint, 'Solid', 'Updated low rating.', 'anonymous', 'Anonymous'), 'pending', 'a buyer edits a published review');
insert into ids select 'mod-old-pending', pg_temp.pending(id) from ids where name = 'mod-low';
select public.store_edit_review((select id from ids where name = 'mod-low'), '345', 'buyer-a', 3::smallint, 'Solid', 'Latest edit.', 'anonymous', 'Anonymous');
select ok(not pg_temp.moderate((select id from ids where name = 'mod-low'), 'approve', (select id from ids where name = 'mod-old-pending')), 'a replaced pending revision is refused even with a current review version');
select is((select r->'published'->>'rating' from pg_temp.queue() r where r->>'id'=(select id::text from ids where name='mod-low')), '1', 'the queue distinguishes public content from a waiting edit');
select ok(pg_temp.moderate((select id from ids where name = 'mod-low'), 'reject', pg_temp.pending((select id from ids where name = 'mod-low')), 'Contains private information'), 'an owner rejects the edit with a reason');
select is((public.store_review_summary('345', array['100'])->>'average'), '1', 'rejecting an edit keeps the approved rating');
select throws_ok($$select pg_temp.moderate((select id from ids where name = 'mod-low'), 'hide')$$, '22023', null, 'hiding requires a reason');
select ok(pg_temp.moderate((select id from ids where name = 'mod-low'), 'hide', note => 'Private information'), 'an owner hides the published review');
select is((public.store_review_summary('345', array['100'])->>'count'), '0', 'hidden reviews leave public totals immediately');
select is((select count(*) from pg_temp.queue('hidden')), 1::bigint, 'hidden reviews remain available to staff');
select ok(pg_temp.moderate((select id from ids where name = 'mod-low'), 'restore'), 'an owner restores the review');
select is((public.store_review_summary('345', array['100'])->>'count'), '1', 'restoring returns the public rating');
select ok(not pg_temp.moderate((select id from ids where name = 'mod-low'), 'restore'), 'a repeated restore makes no second event');
select ok((select bool_and(actor = '00000000-0000-4000-8000-000000000901') from public.store_review_events
  where review_id = (select id from ids where name = 'mod-low') and actor_kind = 'staff'), 'staff audit actors come from the verified Tasks identity');
select ok((select exists(select 1 from pg_temp.queue('all') r, jsonb_array_elements(r->'recentEvents') e
  where r->>'id'=(select id::text from ids where name='mod-low') and e->>'note'='Private information')), 'staff see private reasons in recent history');
select ok((select bool_and(r::text !~ 'Private information|00000000-0000-4000-8000-000000000901') from public.store_public_reviews('345', array['100'], 50) r), 'public reads contain no staff identity or reason');
select public.store_withdraw_review((select id from ids where name = 'mod-low'), '345', 'buyer-a');
select ok(not pg_temp.moderate((select id from ids where name = 'mod-low'), 'restore'), 'staff cannot restore buyer-withdrawn reviews');

-- A failed required audit insert rolls the decision back, including its token.
set local role postgres;
create function pg_temp.fail_moderation_audit() returns trigger language plpgsql as $$
  begin if new.note = 'simulate audit failure' then raise exception 'audit unavailable'; end if; return new; end;
$$;
create trigger test_moderation_audit_failure before insert on public.store_review_events for each row execute function pg_temp.fail_moderation_audit();
set local role service_role;
select throws_ok($$select pg_temp.moderate((select id from ids where name = 'mod-high'), 'reject', pg_temp.pending((select id from ids where name = 'mod-high')), 'simulate audit failure')$$, 'P0001', 'audit unavailable', 'audit failure refuses the whole moderation transaction');
select ok(pg_temp.pending((select id from ids where name = 'mod-high')) is not null, 'failed audit leaves the pending revision intact');
select is((select count(*) from public.store_review_events where review_id=(select id from ids where name='mod-high') and actor_kind='staff'), 0::bigint, 'failed audit leaves no partial staff history');
set local role postgres;

-- --- official replies through the owner boundary ---------------------------------
create function pg_temp.reply(review uuid, body text, expected timestamptz default null) returns boolean language sql as $$
  select public.store_save_review_reply('00000000-0000-4000-8000-000000000901', '345', review,
    coalesce(expected, (select updated_at from public.store_reviews where id = review)), body);
$$;
create function pg_temp.staff_v2(review uuid) returns jsonb language sql as $$
  select r from public.store_review_moderation_page_v2('00000000-0000-4000-8000-000000000901', '345', 'all', 51) r where r->>'id'=review::text;
$$;
create temp table reply_versions (name text primary key, version timestamptz);
grant select, insert on reply_versions to service_role;
set local role service_role;
select throws_ok($$select * from public.store_review_moderation_page_v2('00000000-0000-4000-8000-000000000902', '345', 'all', 20)$$, '42501', null, 'reply-aware staff reads recheck the owner');
select throws_ok($$select public.store_save_review_reply('00000000-0000-4000-8000-000000000902', '345', gen_random_uuid(), now(), 'Hi')$$, '42501', null, 'a member cannot write an official reply');
insert into ids select 'reply', review_id from pg_temp.submit('803', shop => '345');
select ok(not pg_temp.reply((select id from ids where name='reply'), 'Too early'), 'pending-only reviews cannot receive official replies');
select ok(pg_temp.moderate((select id from ids where name='reply'), 'approve', pg_temp.pending((select id from ids where name='reply'))), 'the review is approved before replying');
insert into reply_versions select 'before-create', updated_at from public.store_reviews where id=(select id from ids where name='reply');
select ok(pg_temp.reply((select id from ids where name='reply'), 'Thanks for the feedback!'), 'an owner creates the official reply');
select ok((select updated_at > (select version from reply_versions where name='before-create') from public.store_reviews where id=(select id from ids where name='reply')), 'reply creation advances the review version');
select is((select author from public.store_review_replies where review_id=(select id from ids where name='reply')), '00000000-0000-4000-8000-000000000901', 'reply authorship uses the verified Tasks actor');
select is(pg_temp.staff_v2((select id from ids where name='reply'))->'reply'->>'body', 'Thanks for the feedback!', 'staff read the current official reply');
select ok(pg_temp.staff_v2((select id from ids where name='reply'))->'reply'->>'updatedAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$', 'staff reply timestamps retain microseconds');
select ok(not exists(select 1 from pg_temp.queue('all') r where r ? 'reply'), 'the original staff projection remains compatible with older deployed code');
select is((select r->'reply'->>'body' from public.store_public_reviews('345',array['100'],50) r where r->>'id'=(select id::text from ids where name='reply')), 'Thanks for the feedback!', 'the official reply appears in the public projection');
select is((select array_agg(key order by key) from public.store_public_reviews('345',array['100'],50) r, jsonb_object_keys(r->'reply') key where r->>'id'=(select id::text from ids where name='reply')), array['body','publishedAt'], 'public replies omit actor and internal version fields');
select is(public.store_review_summary('345',array['100'])->>'average', '5', 'a reply does not change the review rating');
select ok(not pg_temp.reply((select id from ids where name='reply'), 'Thanks for the feedback!'), 'an unchanged reply creates no duplicate decision');
select is((select count(*) from public.store_review_events where review_id=(select id from ids where name='reply') and action='reply_set'), 1::bigint, 'one reply write makes one required audit event');
insert into reply_versions select 'before-edit', updated_at from public.store_reviews where id=(select id from ids where name='reply');
select ok(pg_temp.reply((select id from ids where name='reply'), 'Updated official reply.'), 'an owner updates the reply');
select ok(not pg_temp.reply((select id from ids where name='reply'), null, (select version from reply_versions where name='before-edit')), 'an old editor cannot remove a newer reply');
select is(pg_temp.staff_v2((select id from ids where name='reply'))->'reply'->>'body', 'Updated official reply.', 'a stale removal preserves the newer reply');
select ok(not public.store_save_review_reply('00000000-0000-4000-8000-000000000901','999',(select id from ids where name='reply'),(select updated_at from public.store_reviews where id=(select id from ids where name='reply')),'Wrong shop'), 'the reply write pins the shop');
select throws_ok($$select pg_temp.reply((select id from ids where name='reply'),'')$$,'22023',null,'an empty string cannot accidentally remove a reply');
select throws_ok($$select pg_temp.reply((select id from ids where name='reply'),repeat('x',2001))$$,'22023',null,'reply storage enforces the 2000-character limit');
select ok(pg_temp.moderate((select id from ids where name='reply'), 'hide', note=>'Review held privately'), 'staff hide the review');
select ok(pg_temp.reply((select id from ids where name='reply'), 'A reply while hidden.'), 'staff can prepare a reply on a hidden approved review');
select is((public.store_review_summary('345',array['100'])->>'count'), '0', 'saving a hidden reply never publishes its review');
select ok(pg_temp.moderate((select id from ids where name='reply'), 'restore'), 'the review is restored separately');
select is((select r->'reply'->>'body' from public.store_public_reviews('345',array['100'],50) r where r->>'id'=(select id::text from ids where name='reply')), 'A reply while hidden.', 'restore reveals the current approved reply');
select public.store_edit_review((select id from ids where name='reply'),'345','buyer-a',4::smallint, 'Solid', 'A waiting buyer edit.','anonymous','Anonymous');
insert into reply_versions select 'before-remove', updated_at from public.store_reviews where id=(select id from ids where name='reply');
select ok(pg_temp.reply((select id from ids where name='reply'),null), 'an owner removes the reply');
select is(pg_temp.staff_v2((select id from ids where name='reply'))->'reply','null'::jsonb,'removal is reflected in the staff queue');
select ok(not pg_temp.moderate((select id from ids where name='reply'),'approve',pg_temp.pending((select id from ids where name='reply')),expected=>(select version from reply_versions where name='before-remove')), 'a reply change also invalidates stale publication decisions');
select ok(not pg_temp.reply((select id from ids where name='reply'),null), 'repeated removal creates no new event');
select public.store_withdraw_review((select id from ids where name='reply'),'345','buyer-a');
select ok(not pg_temp.reply((select id from ids where name='reply'),'Cannot revive a withdrawal'), 'an owner cannot reply to a buyer-withdrawn review');

-- The reply change, review token, and required audit entry roll back together.
insert into ids select 'reply-fail', review_id from pg_temp.submit('809',shop=>'345');
select pg_temp.moderate((select id from ids where name='reply-fail'),'approve',pg_temp.pending((select id from ids where name='reply-fail')));
select pg_temp.reply((select id from ids where name='reply-fail'),'Original reply.');
insert into reply_versions select 'before-failure', updated_at from public.store_reviews where id=(select id from ids where name='reply-fail');
set local role postgres;
create function pg_temp.fail_reply_audit() returns trigger language plpgsql as $$
  begin
    if new.action in ('reply_set','reply_removed') and exists(select 1 from public.store_reviews r where r.id=new.review_id and r.line_id='809') then
      raise exception 'reply audit unavailable';
    end if;
    return new;
  end;
$$;
create trigger test_reply_audit_failure before insert on public.store_review_events for each row execute function pg_temp.fail_reply_audit();
set local role service_role;
select throws_ok($$select pg_temp.reply((select id from ids where name='reply-fail'),'Uncommitted reply.')$$,'P0001','reply audit unavailable','a failed reply audit refuses the entire update');
select throws_ok($$select pg_temp.reply((select id from ids where name='reply-fail'),null)$$,'P0001','reply audit unavailable','a failed removal audit refuses the entire deletion');
select is(pg_temp.staff_v2((select id from ids where name='reply-fail'))->'reply'->>'body','Original reply.','failed audited writes preserve the original reply');
select is((select updated_at from public.store_reviews where id=(select id from ids where name='reply-fail')),(select version from reply_versions where name='before-failure'),'failed audited writes preserve the original concurrency token');
set local role postgres;

select * from finish();
rollback;
