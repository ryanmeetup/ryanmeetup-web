-- Fulfillment sends only newly verified orders that have not already gone to
-- production. Keep existing manifests immutable; require explicit cancellation
-- before replacing an unsent file prepared with the old, broader queue.
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
  if found then
    return to_jsonb(snapshot) || jsonb_build_object('requires_rebuild',
      not public.ryd_fulfillment_is_ready(snapshot.id));
  end if;
  if recipient is null or char_length(recipient) > 254
    or recipient !~ '^[^[:space:]@,;<>?&#="]+@[^[:space:]@,;<>?&#="]+\.[^[:space:]@,;<>?&#="]+$' then
    raise exception using errcode = 'RY409', message = 'Add a valid fulfillment email in RY-D settings before preparing a batch.';
  end if;
  select headers into source_headers from public.ryd_imports order by uploaded_at desc, id desc limit 1;
  -- Lock in the same stable order as production operations. Build the manifest
  -- from this one statement, without the Data API's row cap or URL ID limits.
  with locked as materialized (
    select * from public.ryd_orders
      where status = 'verified' and cleared_batch_id is null
        and production_sent_at is null and done_at is null
      order by order_id for update
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
  return to_jsonb(snapshot) || jsonb_build_object('requires_rebuild', false);
end;
$function$;

create or replace function public.ryd_finish_fulfillment(
  requested_actor uuid, requested_snapshot uuid, requested_action text
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  snapshot public.ryd_fulfillment_snapshots;
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
    if not public.ryd_fulfillment_is_ready(snapshot.id) then
      raise exception using errcode = 'RY409', message = 'This batch includes orders still being checked or already sent for production. Cancel the unsent batch and prepare a new one.';
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

notify pgrst, 'reload schema';
commit;
