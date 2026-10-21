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
