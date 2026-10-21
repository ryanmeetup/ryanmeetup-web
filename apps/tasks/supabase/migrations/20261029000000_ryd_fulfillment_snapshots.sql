-- One resumable fulfillment snapshot, shared by authorized reviewers. Preparing
-- does not send anything. Reservations have no automatic expiry: a file may
-- already have been emailed, so only explicit cancellation releases it.
begin;

create table if not exists public.ryd_fulfillment_snapshots (
  id uuid primary key default gen_random_uuid(),
  state text not null default 'prepared' check (state in ('prepared', 'sent', 'cancelled')),
  recipient text not null,
  headers jsonb not null check (jsonb_typeof(headers) = 'array'),
  order_rows jsonb not null check (jsonb_typeof(order_rows) = 'array'),
  verified_ids text[] not null,
  response_keys text[] not null,
  form_id text,
  prepared_by uuid not null references public.profiles(id) on delete restrict,
  prepared_at timestamptz not null default now(),
  finished_by uuid references public.profiles(id) on delete restrict,
  finished_at timestamptz,
  check ((state = 'prepared') = (finished_at is null)),
  check ((finished_at is null) = (finished_by is null))
);
create unique index if not exists ryd_fulfillment_one_prepared_idx
  on public.ryd_fulfillment_snapshots ((true)) where state = 'prepared';
alter table public.ryd_fulfillment_snapshots enable row level security;
revoke all on public.ryd_fulfillment_snapshots from public, anon, authenticated;
grant all on public.ryd_fulfillment_snapshots to service_role;

create or replace function public.ryd_guard_reserved_order()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  previous_order text;
  next_order text;
begin
  if tg_op <> 'INSERT' then previous_order := old.order_id; end if;
  if tg_op <> 'DELETE' then next_order := new.order_id; end if;
  if tg_table_name = 'ryd_orders' then
    if tg_op = 'UPDATE' then
      if new.order_id is not distinct from old.order_id
        and new.status is not distinct from old.status
        and new.raw is not distinct from old.raw
        and new.cleared_batch_id is not distinct from old.cleared_batch_id then
        return new;
      end if;
    end if;
  end if;
  if exists (select 1 from public.ryd_fulfillment_snapshots s
    where s.state = 'prepared'
      and (previous_order = any(s.verified_ids) or next_order = any(s.verified_ids))) then
    raise exception using errcode = 'RY409',
      message = 'This order is reserved by a fulfillment batch. Mark that batch sent or cancel it before changing its evidence or decision.';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;
drop trigger if exists ryd_guard_reserved_order on public.ryd_orders;
create trigger ryd_guard_reserved_order before update or delete on public.ryd_orders
  for each row execute function public.ryd_guard_reserved_order();
drop trigger if exists ryd_guard_reserved_evidence on public.ryd_order_submissions;
create trigger ryd_guard_reserved_evidence before insert or update or delete on public.ryd_order_submissions
  for each row execute function public.ryd_guard_reserved_order();

create or replace function public.ryd_prepare_fulfillment(requested_actor uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  snapshot public.ryd_fulfillment_snapshots;
  recipient text;
  form text;
  source_headers jsonb;
  rows jsonb;
  ready text[];
  responses text[];
begin
  perform public.ryd_require_operator(requested_actor);
  select fulfillment_email, form_id into recipient, form from public.ryd_settings where id for share;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-fulfillment', 0));
  select * into snapshot from public.ryd_fulfillment_snapshots where state = 'prepared';
  if found then return to_jsonb(snapshot); end if;
  if recipient is null or char_length(recipient) > 254
    or recipient !~ '^[^[:space:]@,;<>?&#="]+@[^[:space:]@,;<>?&#="]+\.[^[:space:]@,;<>?&#="]+$' then
    raise exception using errcode = 'RY409', message = 'Add a valid fulfillment email in RY-D settings before preparing a batch.';
  end if;
  select headers into source_headers from public.ryd_imports order by uploaded_at desc, id desc limit 1;
  -- Lock in the same stable order as production operations. Build the manifest
  -- from this one statement, without the Data API's row cap or URL ID limits.
  with locked as materialized (
    select * from public.ryd_orders where cleared_batch_id is null order by order_id for update
  ) select
    coalesce(jsonb_agg(jsonb_build_object('order_id', order_id, 'raw', raw,
      'status', status, 'first_name', first_name, 'last_name', last_name,
      'updated_at', updated_at) order by created_at, import_position, order_id), '[]'),
    coalesce(array_agg(order_id order by order_id) filter (where status = 'verified'), '{}')
    into rows, ready from locked;
  if cardinality(ready) = 0 then
    raise exception using errcode = 'RY409', message = 'There are no unsent verified orders to prepare.';
  end if;
  select coalesce(array_agg(submission_key order by submission_key), '{}') into responses
    from public.ryd_order_submissions where order_id = any(ready);
  insert into public.ryd_fulfillment_snapshots(recipient, headers, order_rows, verified_ids,
      response_keys, form_id, prepared_by)
    values(recipient, coalesce(source_headers, '[]'), rows, ready, responses, form, requested_actor)
    returning * into snapshot;
  return to_jsonb(snapshot);
end;
$function$;

create or replace function public.ryd_finish_fulfillment(
  requested_actor uuid, requested_snapshot uuid, requested_action text
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  snapshot public.ryd_fulfillment_snapshots;
  valid_count integer;
  finished timestamptz := clock_timestamp();
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_action is null or requested_action not in ('confirm', 'cancel') then
    raise exception using errcode = 'RY400', message = 'Choose a valid fulfillment action.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-fulfillment', 0));
  select * into snapshot from public.ryd_fulfillment_snapshots where id = requested_snapshot for update;
  if not found then
    raise exception using errcode = 'RY404', message = 'That fulfillment batch no longer exists.';
  end if;
  if (snapshot.state = 'sent' and requested_action = 'confirm')
    or (snapshot.state = 'cancelled' and requested_action = 'cancel') then
    return jsonb_build_object('changed', false, 'snapshot', to_jsonb(snapshot));
  end if;
  if snapshot.state <> 'prepared' then
    raise exception using errcode = 'RY409', message = 'That fulfillment batch has already been finished. Prepare or resume the current batch.';
  end if;
  if requested_action = 'confirm' then
    perform 1 from public.ryd_orders where order_id = any(snapshot.verified_ids) order by order_id for update;
    select count(*) into valid_count from public.ryd_orders
      where order_id = any(snapshot.verified_ids) and status = 'verified' and cleared_batch_id is null;
    if valid_count <> cardinality(snapshot.verified_ids) then
      raise exception using errcode = 'RY409', message = 'This batch has conflicting orders. Resolve it before confirming the send.';
    end if;
  end if;
  -- Release reservations in this transaction only; a failure below restores
  -- the prepared state, all reservations, the orders, and their history.
  update public.ryd_fulfillment_snapshots
    set state = case requested_action when 'confirm' then 'sent' else 'cancelled' end,
      finished_by = requested_actor, finished_at = finished
    where id = snapshot.id returning * into snapshot;
  if requested_action = 'confirm' then
    insert into public.ryd_fulfillment_batches(id, recipient, order_count, verified_count, sent_by, sent_at)
      values(snapshot.id, snapshot.recipient, jsonb_array_length(snapshot.order_rows),
        cardinality(snapshot.verified_ids), requested_actor, finished);
    update public.ryd_orders set cleared_batch_id = snapshot.id, updated_at = finished
      where order_id = any(snapshot.verified_ids);
    insert into public.ryd_order_events(order_id, action, detail, actor_id)
      select unnest(snapshot.verified_ids), 'sent',
        jsonb_build_object('batch_id', snapshot.id, 'recipient', snapshot.recipient), requested_actor;
  end if;
  return jsonb_build_object('changed', true, 'snapshot', to_jsonb(snapshot));
end;
$function$;

revoke all on function public.ryd_guard_reserved_order() from public, anon, authenticated;
revoke all on function public.ryd_prepare_fulfillment(uuid) from public, anon, authenticated;
revoke all on function public.ryd_finish_fulfillment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.ryd_prepare_fulfillment(uuid) to service_role;
grant execute on function public.ryd_finish_fulfillment(uuid, uuid, text) to service_role;
notify pgrst, 'reload schema';
commit;
