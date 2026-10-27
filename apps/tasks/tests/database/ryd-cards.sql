begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000701', 'ryd-card-owner@example.test', '{}');
set local session_replication_role = replica;
update public.profiles set app_role = 'owner', onboarding_completed = true
  where id = '00000000-0000-4000-8000-000000000701';
set local session_replication_role = origin;
insert into public.instance_settings(id, ryd_enabled) values(true, true)
  on conflict(id) do update set ryd_enabled = true;
insert into public.ryd_imports(id, filename, headers, row_count, new_count, uploaded_by)
  values('20000000-0000-4000-8000-000000000701', 'cards.csv', '[]', 3, 3, '00000000-0000-4000-8000-000000000701');
insert into public.ryd_orders(order_id, raw, first_import_id, status, production_sent_at) values
  ('card-1', '{}', '20000000-0000-4000-8000-000000000701', 'pending', null),
  ('card-2', '{}', '20000000-0000-4000-8000-000000000701', 'pending', null),
  ('card-sent', '{}', '20000000-0000-4000-8000-000000000701', 'verified', now());

create function pg_temp.review(order_id text, patch jsonb) returns jsonb language sql as $$
  select public.ryd_review_order('00000000-0000-4000-8000-000000000701', order_id, patch)
$$;

select throws_ok($$select pg_temp.review('card-1', '{"status":"verified"}')$$,
  'RY400', 'Fill in every line of the card, with a four-digit Ryan since year, before verifying.',
  'an order without a saved card cannot be verified');
select throws_ok($$select pg_temp.review('card-1', '{"status":"verified","card":{"firstName":"Ryan","lastName":"Le","location":"","ryanSince":"1999"}}')$$,
  'RY400', 'Fill in every line of the card, with a four-digit Ryan since year, before verifying.',
  'a blank line blocks verification');
select is((select status from public.ryd_orders where order_id = 'card-1'), 'pending',
  'a refused verification saves nothing');
select throws_ok($$select pg_temp.review('card-1', '{"card":{"firstName":"Ryan","lastName":"Le","location":"NYC"}}')$$,
  'RY400', 'Send every line of the card.', 'a partial card is refused');
select throws_ok($$select pg_temp.review('card-1', '{"card":{"firstName":"Ryan","lastName":"Le","location":"NYC","ryanSince":"76"}}')$$,
  'RY400', null, 'Ryan since must be a four-digit year');

select lives_ok($$select pg_temp.review('card-1', '{"card":{"firstName":" Ryan ","lastName":"Le","location":"Brooklyn, NY","ryanSince":""}}')$$,
  'an unfinished card can be saved before verification');
select ok((select card_first_name = 'Ryan' and card_ryan_since = '' and card_saved_by is not null and status = 'pending'
  from public.ryd_orders where order_id = 'card-1'), 'the saved card is trimmed and attributed');
select throws_ok($$select pg_temp.review('card-1', '{"status":"verified"}')$$,
  'RY400', null, 'the saved card still needs its year');
select lives_ok($$select pg_temp.review('card-1', '{"status":"verified","card":{"firstName":"Ryan","lastName":"Le","location":"Brooklyn, NY","ryanSince":"1999"}}')$$,
  'verifying with a complete card saves the card and the decision together');
select ok((select status = 'verified' and card_ryan_since = '1999' from public.ryd_orders where order_id = 'card-1'),
  'the approved card is stored on the verified order');
select is((select count(*) from public.ryd_order_events where order_id = 'card-1' and action = 'card'), 2::bigint,
  'each card change is audited');
-- One transaction stamps both events alike, so tell them apart by content.
select ok((select (detail->>'approved')::boolean from public.ryd_order_events
  where order_id = 'card-1' and action = 'card' and detail->>'ryanSince' = '1999'),
  'the card saved with the verification is recorded as approved');
select ok((select not (detail->>'approved')::boolean from public.ryd_order_events
  where order_id = 'card-1' and action = 'card' and detail->>'ryanSince' = ''),
  'an unfinished card saved before verification is not approved');
select lives_ok($$select pg_temp.review('card-1', '{"card":{"firstName":"Ryan","lastName":"Le","location":"Brooklyn, NY","ryanSince":"1999"}}')$$,
  'saving an unchanged card is a no-op');
select is((select count(*) from public.ryd_order_events where order_id = 'card-1' and action = 'card'), 2::bigint,
  'an unchanged card adds no audit event');
select throws_ok($$select pg_temp.review('card-1', '{"card":{"firstName":"Ryan","lastName":"Le","location":"","ryanSince":"1999"}}')$$,
  'RY400', null, 'a verified card cannot be blanked');
select lives_ok($$select pg_temp.review('card-1', '{"card":{"firstName":"Ryan","lastName":"Le","location":"Brooklyn","ryanSince":"1999"}}')$$,
  'a verified card can be corrected before it goes to fulfillment');

select throws_ok($$select pg_temp.review('card-sent', '{"card":{"firstName":"Ryan","lastName":"Le","location":"Queens","ryanSince":"1999"}}')$$,
  'RY409', 'This card has already gone to fulfillment. It cannot be changed.',
  'a card already with fulfillment is frozen');
select lives_ok($$select pg_temp.review('card-2', '{"status":"rejected"}')$$, 'cancels an order');
select throws_ok($$select pg_temp.review('card-2', '{"card":{"firstName":"Ryan","lastName":"Le","location":"Queens","ryanSince":"1999"}}')$$,
  'RY409', 'A cancelled order has no card to change.', 'a cancelled order has no card');
select lives_ok($$select pg_temp.review('card-2', '{"note":"Never verified"}')$$,
  'a note alone still saves without a card');

select * from finish();
rollback;
