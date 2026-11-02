-- Repair the missing card schema and private fulfillment functions reported by
-- PRD's contract check after bulk reviews were installed. Definitions come from
-- 20261104/06/12/13; keep the newer contract and access predicates in place.
-- All operations are idempotent. No feature switch or customer row is changed.
begin;

create or replace function public.ryd_fulfillment_is_ready(requested_snapshot uuid)
returns boolean language sql stable security invoker set search_path = '' as $function$
  select exists (
    select 1 from public.ryd_fulfillment_snapshots s
    where s.id = requested_snapshot and s.state = 'prepared'
      and cardinality(s.verified_ids) > 0
      and jsonb_array_length(s.order_rows) = cardinality(s.verified_ids)
      and (select count(*) from public.ryd_orders o
        where o.order_id = any(s.verified_ids) and o.status = 'verified'
          and o.cleared_batch_id is null and o.production_sent_at is null
          and o.done_at is null) = cardinality(s.verified_ids)
  );
$function$;
revoke all on function public.ryd_fulfillment_is_ready(uuid) from public, anon, authenticated;
grant execute on function public.ryd_fulfillment_is_ready(uuid) to service_role;

create or replace function public.ryd_generate_fulfillment(requested_actor uuid, requested_orders text[])
returns jsonb language plpgsql stable security invoker set search_path = '' as $function$
declare
  selected text[];
  ready text[];
  recipient text;
  source_headers jsonb;
  rows jsonb;
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_orders is null or cardinality(requested_orders) not between 1 and 5000
    or exists(select 1 from unnest(requested_orders) id
      where id is null or btrim(id) = '' or char_length(id) > 64) then
    raise exception using errcode = 'RY400', message = 'Select between 1 and 5000 ready orders.';
  end if;
  select fulfillment_email into recipient from public.ryd_settings where id;
  if recipient is null or char_length(recipient) > 254
    or recipient !~ '^[^[:space:]@,;<>?&#="]+@[^[:space:]@,;<>?&#="]+\.[^[:space:]@,;<>?&#="]+$' then
    raise exception using errcode = 'RY409', message = 'Add a valid fulfillment email in RY-D settings before generating an email.';
  end if;
  select array_agg(distinct id order by id) into selected from unnest(requested_orders) id;
  select headers into source_headers from public.ryd_imports order by uploaded_at desc, id desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('order_id', order_id, 'raw', raw,
      'status', status, 'first_name', first_name, 'last_name', last_name)
      order by created_at, import_position, order_id), '[]'),
    coalesce(array_agg(order_id order by order_id)
      filter(where status='verified' and cleared_batch_id is null
        and production_sent_at is null and done_at is null), '{}')
    into rows, ready from public.ryd_orders where order_id=any(selected);
  if ready <> selected then
    raise exception using errcode = 'RY409', message = 'Some selected orders are no longer ready to send. Refresh the queue and select ready orders again.';
  end if;
  return jsonb_build_object('recipient',recipient,'headers',coalesce(source_headers,'[]'),
    'order_rows',rows,'generated_at',statement_timestamp());
end;
$function$;
revoke all on function public.ryd_generate_fulfillment(uuid,text[]) from public, anon, authenticated;
grant execute on function public.ryd_generate_fulfillment(uuid,text[]) to service_role;

-- The card a RY-D prints: name, location, and the year the buyer has been a
-- Ryan. NULL across the board means nobody has saved this order's card yet, and
-- the app shows a draft read from the export instead. Verifying requires a
-- complete saved card, so what was approved is exactly what gets printed.

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

-- Card batches: the file fulfillment prints from. Pulling one takes every
-- verified order with an approved card that is still ready to send, freezes
-- those cards, and marks the orders sent to fulfillment with the batch date in
-- the same transaction, so nothing is printed twice. A batch is downloaded
-- again from its frozen rows, never rebuilt from the live queue.

create table if not exists public.ryd_card_batches (
  id uuid primary key default gen_random_uuid(),
  order_count integer not null check (order_count > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.ryd_card_batch_orders (
  batch_id uuid not null references public.ryd_card_batches (id) on delete cascade,
  order_id text not null references public.ryd_orders (order_id) on delete cascade,
  position integer not null check (position >= 0),
  first_name text not null,
  last_name text not null,
  location text not null,
  ryan_since text not null,
  primary key (batch_id, order_id),
  unique (batch_id, position)
);

create index if not exists ryd_card_batch_orders_order_idx
  on public.ryd_card_batch_orders (order_id);

-- Customer data: service role only, like every RY-D table.
alter table public.ryd_card_batches enable row level security;
alter table public.ryd_card_batch_orders enable row level security;
revoke all on public.ryd_card_batches from public, anon, authenticated;
revoke all on public.ryd_card_batch_orders from public, anon, authenticated;
grant all on public.ryd_card_batches to service_role;
grant all on public.ryd_card_batch_orders to service_role;

alter table public.ryd_write_receipts drop constraint if exists ryd_write_receipts_kind_check;
alter table public.ryd_write_receipts add constraint ryd_write_receipts_kind_check
  check (kind in ('import', 'reminder', 'production', 'contact', 'card-batch'));

create or replace function public.ryd_create_card_batch(requested_actor uuid, requested_operation uuid)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  receipt public.ryd_write_receipts;
  batch_id uuid;
  ids text[];
  result jsonb;
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_operation is null then
    raise exception using errcode = 'RY400', message = 'Start a valid card download.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-operation:' || requested_operation::text, 0));
  select * into receipt from public.ryd_write_receipts where operation_id = requested_operation;
  if found then
    if receipt.actor_id <> requested_actor or receipt.kind <> 'card-batch' then
      raise exception using errcode = 'RY409', message = 'That operation was used for different content. Start a new operation.';
    end if;
    return receipt.result;
  end if;
  -- One batch at a time, so two people pulling at once cannot share an order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-card-batch', 0));

  select array_agg(order_id order by created_at, order_id) into ids
  from (
    select o.order_id, o.created_at from public.ryd_orders o
    where o.status = 'verified'
      and o.cleared_batch_id is null
      and o.production_sent_at is null
      and o.done_at is null
      and public.ryd_card_complete(o)
    order by o.created_at, o.order_id
    for update
  ) ready;

  if ids is null then
    result := jsonb_build_object('batchId', null, 'orderCount', 0);
  else
    batch_id := gen_random_uuid();
    insert into public.ryd_card_batches (id, order_count, created_by)
      values (batch_id, cardinality(ids), requested_actor);
    insert into public.ryd_card_batch_orders
      (batch_id, order_id, position, first_name, last_name, location, ryan_since)
    select batch_id, o.order_id, ordinality::integer - 1,
      btrim(o.card_first_name), btrim(o.card_last_name), btrim(o.card_location), o.card_ryan_since
    from unnest(ids) with ordinality as picked(order_id, ordinality)
    join public.ryd_orders o on o.order_id = picked.order_id;
    -- The same handoff a manual "Mark sent to fulfillment" records.
    insert into public.ryd_fulfillment_batches (id, recipient, order_count, verified_count, sent_by)
      values (batch_id, null, cardinality(ids), cardinality(ids), requested_actor);
    update public.ryd_orders set cleared_batch_id = batch_id, updated_at = clock_timestamp()
      where order_id = any(ids);
    perform public.ryd_set_production(requested_actor, ids, 'in-production');
    insert into public.ryd_order_events (order_id, action, detail, actor_id)
      select unnest(ids), 'sent',
        jsonb_build_object('stage', 'sent-to-fulfillment', 'cardBatch', batch_id), requested_actor;
    result := jsonb_build_object('batchId', batch_id, 'orderCount', cardinality(ids));
  end if;

  insert into public.ryd_write_receipts (operation_id, actor_id, kind, input_hash, result)
    values (requested_operation, requested_actor, 'card-batch',
      encode(sha256(convert_to('card-batch', 'UTF8')), 'hex'), result);
  return result;
end;
$function$;

revoke all on function public.ryd_create_card_batch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ryd_create_card_batch(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
