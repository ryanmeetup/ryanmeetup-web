# PRD: saved RY-D fulfillment batches

Run both complete blocks in the **PRD** Supabase dashboard SQL Editor, for
`projects.ryanle.dev` (project `vjsnobmfsfrsnwukfaoq`). RMT is applied and
verified separately by the agent. No PRD CLI access is required.

The first block includes the prerequisite review migration `20261028000000`
and the fulfillment migration `20261029000000`, copied in full. Both are safe
to re-run, so it also covers an instance where the earlier review update has
already been applied. Conflicting historical claims or invalid production
rows make the review transaction fail; resolve those records explicitly.
No customer rows are deleted by this update.

```sql
-- Review writes are service-role RPCs. A route authenticates the caller and
-- validates Google response IDs; the database rechecks page authority and the
-- configured form under a lock, enforces invariants, and commits audit events
-- with each change. Do not silently discard conflicting historical claims.
begin;

create unique index if not exists ryd_order_submissions_one_order_idx
  on public.ryd_order_submissions (submission_key);

alter table public.ryd_orders
  drop constraint if exists ryd_orders_verified_production_check;
alter table public.ryd_orders
  add constraint ryd_orders_verified_production_check
  check (production_sent_at is null or status = 'verified');

create or replace function public.ryd_require_operator(requested_actor uuid)
returns void language plpgsql security invoker set search_path = '' as $function$
begin
  if not exists (select 1 from public.instance_settings where ryd_enabled is true)
    or not exists (
      select 1 from public.profiles p
      where p.id = requested_actor and p.onboarding_completed
        and (p.app_role = 'owner' or exists (
          select 1 from public.workspace_area_access a
          where a.area = 'ryd' and (a.access_mode = 'open' or exists (
            select 1 from public.workspace_area_group_grants g
            where g.area = a.area and public.member_has_group_access(p.id, g.group_id)
          ))
        ))
    ) then
    raise exception using errcode = '42501', message = 'RY-D access is required.';
  end if;
end;
$function$;

-- The application does not silently reinterpret saved response IDs against a
-- different form. Replacing the evidence source requires resolving those refs.
create or replace function public.ryd_guard_form_change()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.form_id is distinct from old.form_id and (
    exists (select 1 from public.ryd_order_submissions)
    or exists (select 1 from public.ryd_dismissed_submissions)
  ) then
    raise exception using errcode = 'RY409',
      message = 'This form has saved pairings or removed responses. Resolve them before changing the form.';
  end if;
  return new;
end;
$function$;
drop trigger if exists ryd_guard_form_change on public.ryd_settings;
create trigger ryd_guard_form_change before update of form_id on public.ryd_settings
  for each row execute function public.ryd_guard_form_change();

create or replace function public.ryd_change_submission(
  requested_actor uuid, requested_order text, requested_key text,
  requested_action text, requested_form text, requested_source text default 'manual'
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  configured_form text;
  claimed_order text;
  changed integer;
begin
  perform public.ryd_require_operator(requested_actor);
  select form_id into configured_form from public.ryd_settings where id for share;
  if configured_form is distinct from requested_form
    or (configured_form is null and requested_action in ('link', 'dismiss')) then
    raise exception using errcode = 'RY409', message = 'The verification form changed. Refresh before trying again.';
  end if;
  if requested_action not in ('link', 'unlink', 'dismiss', 'restore')
    or requested_action is null or char_length(requested_key) not between 3 and 400
    or requested_key is null or requested_source not in ('manual', 'suggested')
    or requested_source is null then
    raise exception using errcode = 'RY400', message = 'Choose a valid submission action.';
  end if;

  -- A response can move between two tables; serialize both operations on the
  -- same key even when neither table has a row to lock yet.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-response:' || requested_key, 0));
  if requested_action in ('link', 'unlink') then
    perform 1 from public.ryd_orders where order_id = requested_order for update;
    if not found then
      raise exception using errcode = 'RY404', message = 'That order no longer exists.';
    end if;
  end if;
  select order_id into claimed_order from public.ryd_order_submissions where submission_key = requested_key;
  if requested_action in ('link', 'dismiss') and claimed_order is not null
    and (requested_action = 'dismiss' or claimed_order <> requested_order) then
    raise exception using errcode = 'RY409', message = 'That response is already linked to an order. Unlink it there first.';
  end if;

  if requested_action = 'link' then
    if exists (select 1 from public.ryd_dismissed_submissions where submission_key = requested_key) then
      raise exception using errcode = 'RY409', message = 'That response was removed. Restore it before linking it.';
    end if;
    insert into public.ryd_order_submissions(order_id, submission_key, source, linked_by)
      values (requested_order, requested_key, requested_source, requested_actor)
      on conflict (order_id, submission_key) do nothing;
    get diagnostics changed = row_count;
  elsif requested_action = 'unlink' then
    delete from public.ryd_order_submissions where order_id = requested_order and submission_key = requested_key;
    get diagnostics changed = row_count;
  elsif requested_action = 'dismiss' then
    insert into public.ryd_dismissed_submissions(submission_key, dismissed_by)
      values (requested_key, requested_actor) on conflict (submission_key) do nothing;
    get diagnostics changed = row_count;
  else
    delete from public.ryd_dismissed_submissions where submission_key = requested_key;
    get diagnostics changed = row_count;
  end if;
  if changed > 0 and requested_action in ('link', 'unlink') then
    insert into public.ryd_order_events(order_id, action, detail, actor_id)
      values (requested_order, case requested_action when 'link' then 'linked' else 'unlinked' end,
        jsonb_build_object('submission_key', requested_key, 'source', requested_source, 'form_id', configured_form), requested_actor);
  end if;
  return jsonb_build_object('ok', true, 'changed', changed > 0);
end;
$function$;

create or replace function public.ryd_review_order(
  requested_actor uuid, requested_order text, requested_patch jsonb,
  requested_form text default null, requested_keys text[] default '{}'
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  current_order public.ryd_orders;
  saved_order public.ryd_orders;
  key text;
  next_status text;
  next_note text;
begin
  perform public.ryd_require_operator(requested_actor);
  -- Same lock order as ryd_change_submission: settings, response keys, order.
  perform 1 from public.ryd_settings where id for share;
  if jsonb_typeof(requested_patch) <> 'object' or requested_patch is null
    or exists (select 1 from jsonb_object_keys(requested_patch) k
      where k not in ('status', 'note', 'expectedStatus', 'expectedUpdatedAt'))
    or not (requested_patch ? 'status' or requested_patch ? 'note')
    or cardinality(requested_keys) > 100
    or (cardinality(requested_keys) > 0 and requested_patch->>'status' is distinct from 'verified') then
    raise exception using errcode = 'RY400', message = 'Choose a valid decision or note.';
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
  for key in select distinct unnest(requested_keys) order by 1 loop
    perform public.ryd_change_submission(requested_actor, requested_order, key, 'link', requested_form, 'suggested');
  end loop;
  if next_status is distinct from current_order.status or next_note is distinct from current_order.note then
    update public.ryd_orders set status = next_status, note = next_note,
      decided_at = case when next_status = current_order.status then decided_at when next_status = 'pending' then null else now() end,
      decided_by = case when next_status = current_order.status then decided_by when next_status = 'pending' then null else requested_actor end,
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
  else saved_order := current_order;
  end if;
  return jsonb_build_object('ok', true, 'order', to_jsonb(saved_order));
end;
$function$;

create or replace function public.ryd_set_production(
  requested_actor uuid, requested_orders text[], requested_stage text
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  current_order public.ryd_orders;
  next_sent timestamptz;
  next_done timestamptz;
  changed_orders jsonb := '[]';
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_stage is null or requested_stage not in ('not-started', 'in-production', 'done')
    or requested_orders is null or cardinality(requested_orders) not between 1 and 500 then
    raise exception using errcode = 'RY400', message = 'Choose orders and a valid production stage.';
  end if;
  for current_order in select * from public.ryd_orders
    where order_id = any(requested_orders) order by order_id for update loop
    if current_order.status <> 'verified' then continue; end if;
    next_sent := case when requested_stage = 'not-started' then null else coalesce(current_order.production_sent_at, now()) end;
    next_done := case when requested_stage = 'done' then coalesce(current_order.done_at, now()) else null end;
    if next_sent is not distinct from current_order.production_sent_at and next_done is not distinct from current_order.done_at then continue; end if;
    update public.ryd_orders set production_sent_at = next_sent, done_at = next_done,
      production_sent_by = case when next_sent is null then null else coalesce(production_sent_by, requested_actor) end,
      done_by = case when next_done is null then null else coalesce(done_by, requested_actor) end,
      updated_at = clock_timestamp() where order_id = current_order.order_id;
    insert into public.ryd_order_events(order_id, action, detail, actor_id)
      values (current_order.order_id, 'production', jsonb_build_object('stage', requested_stage), requested_actor);
    changed_orders := changed_orders || to_jsonb(current_order.order_id);
  end loop;
  return jsonb_build_object('movedCount', jsonb_array_length(changed_orders), 'orderIds', changed_orders);
end;
$function$;

revoke all on function public.ryd_require_operator(uuid) from public, anon, authenticated;
revoke all on function public.ryd_guard_form_change() from public, anon, authenticated;
revoke all on function public.ryd_change_submission(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.ryd_review_order(uuid, text, jsonb, text, text[]) from public, anon, authenticated;
revoke all on function public.ryd_set_production(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.ryd_require_operator(uuid) to service_role;
grant execute on function public.ryd_change_submission(uuid, text, text, text, text, text) to service_role;
grant execute on function public.ryd_review_order(uuid, text, jsonb, text, text[]) to service_role;
grant execute on function public.ryd_set_production(uuid, text[], text) to service_role;

notify pgrst, 'reload schema';
commit;

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
```

Then run this verification block on **PRD**. Expected: one row, with all ten
values `true`.

```sql
select
  to_regprocedure('public.ryd_review_order(uuid,text,jsonb,text,text[])') is not null as review_rpc,
  to_regprocedure('public.ryd_prepare_fulfillment(uuid)') is not null as prepare_rpc,
  to_regprocedure('public.ryd_finish_fulfillment(uuid,uuid,text)') is not null as finish_rpc,
  exists(select 1 from pg_class where oid=to_regclass('public.ryd_fulfillment_snapshots') and relrowsecurity) as private_table_rls,
  not has_table_privilege('authenticated','public.ryd_fulfillment_snapshots','SELECT') as private_table_grants,
  not has_function_privilege('authenticated','public.ryd_prepare_fulfillment(uuid)','EXECUTE') as private_prepare,
  not has_function_privilege('authenticated','public.ryd_finish_fulfillment(uuid,uuid,text)','EXECUTE') as private_finish,
  exists(select 1 from pg_indexes where schemaname='public' and indexname='ryd_fulfillment_one_prepared_idx') as one_prepared_batch,
  exists(select 1 from pg_trigger where tgrelid='public.ryd_orders'::regclass and tgname='ryd_guard_reserved_order' and tgenabled <> 'D') as order_guard,
  exists(select 1 from pg_trigger where tgrelid='public.ryd_order_submissions'::regclass and tgname='ryd_guard_reserved_evidence' and tgenabled <> 'D') as evidence_guard;
```
