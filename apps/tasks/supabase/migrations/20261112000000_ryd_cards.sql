-- The card a RY-D prints: name, location, and the year the buyer has been a
-- Ryan. NULL across the board means nobody has saved this order's card yet, and
-- the app shows a draft read from the export instead. Verifying requires a
-- complete saved card, so what was approved is exactly what gets printed.
begin;

alter table public.ryd_orders
  add column if not exists card_first_name text,
  add column if not exists card_last_name text,
  add column if not exists card_location text,
  add column if not exists card_ryan_since text,
  add column if not exists card_saved_by uuid references public.profiles (id) on delete set null,
  add column if not exists card_saved_at timestamptz;

alter table public.ryd_orders drop constraint if exists ryd_orders_card_shape;
alter table public.ryd_orders add constraint ryd_orders_card_shape check (
  char_length(card_first_name) <= 80
  and char_length(card_last_name) <= 80
  and char_length(card_location) <= 120
  and card_ryan_since ~ '^([0-9]{4})?$'
);

alter table public.ryd_order_events drop constraint if exists ryd_order_events_action_check;
alter table public.ryd_order_events add constraint ryd_order_events_action_check check (
  action in ('imported', 'status', 'note', 'linked', 'unlinked', 'emailed', 'sent', 'production', 'card')
);

-- Whether a stored card can be printed.
create or replace function public.ryd_card_complete(requested_order public.ryd_orders)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select coalesce(
    btrim(requested_order.card_first_name) <> ''
    and btrim(requested_order.card_last_name) <> ''
    and btrim(requested_order.card_location) <> ''
    and requested_order.card_ryan_since ~ '^[0-9]{4}$'
    and requested_order.card_ryan_since::integer between 1900
      and extract(year from now())::integer,
    false
  );
$function$;

revoke all on function public.ryd_card_complete(public.ryd_orders) from public, anon, authenticated;
grant execute on function public.ryd_card_complete(public.ryd_orders) to service_role;

create or replace function public.ryd_review_order(
  requested_actor uuid,
  requested_order text,
  requested_patch jsonb,
  requested_form text default null,
  requested_keys text[] default '{}'
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  current_order public.ryd_orders;
  saved_order public.ryd_orders;
  key text;
  next_status text;
  next_note text;
  card jsonb := requested_patch->'card';
  card_changed boolean := false;
begin
  perform public.ryd_require_operator(requested_actor);
  -- Same lock order as ryd_change_submission: settings, response keys, order.
  perform 1 from public.ryd_settings where id for share;
  if jsonb_typeof(requested_patch) <> 'object' or requested_patch is null
    or exists (select 1 from jsonb_object_keys(requested_patch) k
      where k not in ('status', 'note', 'card', 'expectedStatus', 'expectedUpdatedAt'))
    or not (requested_patch ? 'status' or requested_patch ? 'note' or requested_patch ? 'card')
    or cardinality(requested_keys) > 100
    or (cardinality(requested_keys) > 0 and requested_patch->>'status' is distinct from 'verified') then
    raise exception using errcode = 'RY400', message = 'Choose a valid decision or note.';
  end if;
  if card is not null and (
    jsonb_typeof(card) <> 'object'
    or (select count(*) from jsonb_object_keys(card)) <> 4
    or exists (select 1 from jsonb_each(card) e
      where e.key not in ('firstName', 'lastName', 'location', 'ryanSince')
        or jsonb_typeof(e.value) <> 'string')
  ) then
    raise exception using errcode = 'RY400', message = 'Send every line of the card.';
  end if;
  for key in select distinct unnest(requested_keys) order by 1 loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-response:' || key, 0));
  end loop;
  select * into current_order from public.ryd_orders where order_id = requested_order for update;
  if not found then
    raise exception using errcode = 'RY404', message = 'That order no longer exists.';
  end if;
  if (requested_patch ? 'expectedStatus' and requested_patch->>'expectedStatus' is distinct from current_order.status)
    or (requested_patch ? 'expectedUpdatedAt' and (requested_patch->>'expectedUpdatedAt')::timestamptz is distinct from current_order.updated_at) then
    raise exception using errcode = 'RY409', message = 'This order changed while you were reviewing it. Refresh and review it again.';
  end if;
  next_status := case when requested_patch ? 'status' then requested_patch->>'status' else current_order.status end;
  next_note := case when requested_patch ? 'note' then nullif(btrim(requested_patch->>'note'), '') else current_order.note end;
  if next_status is null or next_status not in ('pending', 'verified', 'needs_info', 'rejected')
    or char_length(next_note) > 2000 then
    raise exception using errcode = 'RY400', message = 'Choose a valid decision and a note of at most 2,000 characters.';
  end if;
  if next_status is distinct from current_order.status
    and (current_order.cleared_batch_id is not null or current_order.production_sent_at is not null) then
    raise exception using errcode = 'RY409', message = 'This order is already with fulfillment or in production. Its decision cannot be changed.';
  end if;

  saved_order := current_order;
  if card is not null then
    saved_order.card_first_name := btrim(card->>'firstName');
    saved_order.card_last_name := btrim(card->>'lastName');
    saved_order.card_location := btrim(card->>'location');
    saved_order.card_ryan_since := btrim(card->>'ryanSince');
    card_changed := saved_order.card_first_name is distinct from current_order.card_first_name
      or saved_order.card_last_name is distinct from current_order.card_last_name
      or saved_order.card_location is distinct from current_order.card_location
      or saved_order.card_ryan_since is distinct from current_order.card_ryan_since;
    if card_changed and (current_order.cleared_batch_id is not null
      or current_order.production_sent_at is not null or current_order.done_at is not null) then
      raise exception using errcode = 'RY409', message = 'This card has already gone to fulfillment. It cannot be changed.';
    end if;
    if card_changed and next_status = 'rejected' then
      raise exception using errcode = 'RY409', message = 'A cancelled order has no card to change.';
    end if;
    if char_length(saved_order.card_first_name) > 80 or char_length(saved_order.card_last_name) > 80
      or char_length(saved_order.card_location) > 120 or saved_order.card_ryan_since !~ '^([0-9]{4})?$' then
      raise exception using errcode = 'RY400', message = 'Keep names to 80 characters, the location to 120, and Ryan since to a four-digit year.';
    end if;
  end if;
  -- A verified card is printed as stored: verifying, or changing a verified
  -- card, needs every line.
  if next_status = 'verified' and (next_status is distinct from current_order.status or card_changed)
    and not public.ryd_card_complete(saved_order) then
    raise exception using errcode = 'RY400', message = 'Fill in every line of the card, with a four-digit Ryan since year, before verifying.';
  end if;

  for key in select distinct unnest(requested_keys) order by 1 loop
    perform public.ryd_change_submission(requested_actor, requested_order, key, 'link', requested_form, 'suggested');
  end loop;
  if next_status is distinct from current_order.status or next_note is distinct from current_order.note or card_changed then
    update public.ryd_orders set status = next_status, note = next_note,
      decided_at = case when next_status = current_order.status then decided_at when next_status = 'pending' then null else now() end,
      decided_by = case when next_status = current_order.status then decided_by when next_status = 'pending' then null else requested_actor end,
      card_first_name = saved_order.card_first_name,
      card_last_name = saved_order.card_last_name,
      card_location = saved_order.card_location,
      card_ryan_since = saved_order.card_ryan_since,
      card_saved_by = case when card_changed then requested_actor else card_saved_by end,
      card_saved_at = case when card_changed then now() else card_saved_at end,
      updated_at = clock_timestamp()
      where order_id = requested_order returning * into saved_order;
    if next_status is distinct from current_order.status then
      insert into public.ryd_order_events(order_id, action, detail, actor_id)
        values (requested_order, 'status', jsonb_build_object('from', current_order.status, 'to', next_status), requested_actor);
    end if;
    if next_note is distinct from current_order.note then
      insert into public.ryd_order_events(order_id, action, detail, actor_id)
        values (requested_order, 'note', jsonb_build_object('note', next_note), requested_actor);
    end if;
    if card_changed then
      insert into public.ryd_order_events(order_id, action, detail, actor_id)
        values (requested_order, 'card', jsonb_build_object(
          'firstName', saved_order.card_first_name,
          'lastName', saved_order.card_last_name,
          'location', saved_order.card_location,
          'ryanSince', saved_order.card_ryan_since,
          -- Changing a verified card re-approves it under the same authority.
          'approved', next_status = 'verified'
        ), requested_actor);
    end if;
  else saved_order := current_order;
  end if;
  return jsonb_build_object('ok', true, 'order', to_jsonb(saved_order));
end;
$function$;

commit;
