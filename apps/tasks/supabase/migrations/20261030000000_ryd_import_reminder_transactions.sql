-- Import and reminder confirmations commit their effects and history together.
-- Small private receipts bind retries to one actor, operation, and input.
begin;
create table if not exists public.ryd_write_receipts (
  operation_id uuid primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null check (kind in ('import', 'reminder')),
  input_hash text not null,
  result jsonb not null,
  completed_at timestamptz not null default now()
);
alter table public.ryd_write_receipts enable row level security;
revoke all on public.ryd_write_receipts from public, anon, authenticated;
grant all on public.ryd_write_receipts to service_role;

create or replace function public.ryd_import_orders(
  requested_actor uuid, requested_operation uuid, requested_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  receipt public.ryd_write_receipts;
  fingerprint text;
  import_id uuid := gen_random_uuid();
  inserted_ids text[];
  preverified integer;
  total integer;
  result jsonb;
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_operation is null or jsonb_typeof(requested_payload) is distinct from 'object'
    or jsonb_typeof(requested_payload->'headers') is distinct from 'array'
    or jsonb_typeof(requested_payload->'orders') is distinct from 'array'
    or jsonb_typeof(requested_payload->'filename') is distinct from 'string'
    or char_length(requested_payload->>'filename') not between 1 and 255
    or jsonb_typeof(requested_payload->'duplicateCount') is distinct from 'number' then
    raise exception using errcode = 'RY400', message = 'Choose a valid order file and upload operation.';
  end if;
  total := jsonb_array_length(requested_payload->'orders');
  if total not between 1 and 50000 or (requested_payload->>'duplicateCount')::integer < 0
    or exists (select 1 from jsonb_array_elements(requested_payload->'headers') h where jsonb_typeof(h) <> 'string')
    or exists (select 1 from jsonb_array_elements(requested_payload->'orders') o
      where jsonb_typeof(o->'orderId') is distinct from 'string'
        or char_length(o->>'orderId') not between 1 and 64
        or jsonb_typeof(o->'raw') is distinct from 'object'
        or jsonb_typeof(o->'verified') is distinct from 'boolean')
    or total <> (select count(distinct o->>'orderId') from jsonb_array_elements(requested_payload->'orders') o) then
    raise exception using errcode = 'RY400', message = 'Upload a CSV with 1 to 50,000 distinct valid orders.';
  end if;
  fingerprint := encode(sha256(convert_to(requested_payload::text, 'UTF8')), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-operation:' || requested_operation::text, 0));
  select * into receipt from public.ryd_write_receipts where operation_id = requested_operation;
  if found then
    if receipt.actor_id <> requested_actor or receipt.kind <> 'import' or receipt.input_hash <> fingerprint then
      raise exception using errcode = 'RY409', message = 'That operation was used for different content. Start a new upload or reminder.';
    end if;
    return receipt.result;
  end if;
  -- Different uploads may overlap in order IDs. Serialize their accounting;
  -- RETURNING is the source of truth for inserted rows and audit events.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-import', 0));
  insert into public.ryd_imports(id, filename, headers, row_count, new_count, uploaded_by)
    values(import_id, requested_payload->>'filename', requested_payload->'headers', total, 0, requested_actor);
  with inserted as (
    insert into public.ryd_orders(order_id, import_position, sales_order, ordered_at,
      first_name, last_name, email, raw, first_import_id, status, note, decided_at, decided_by)
    select o->>'orderId', ordinal::integer - 1, coalesce(o->>'salesOrder',''), coalesce(o->>'orderedAt',''),
      coalesce(o->>'firstName',''), coalesce(o->>'lastName',''), lower(btrim(coalesce(o->>'email',''))), o->'raw', import_id,
      case when (o->>'verified')::boolean then 'verified' else 'pending' end,
      case when (o->>'verified')::boolean then 'Already ticked in the fulfillment file.' end,
      case when (o->>'verified')::boolean then now() end,
      case when (o->>'verified')::boolean then requested_actor end
    from jsonb_array_elements(requested_payload->'orders') with ordinality as source(o, ordinal)
    order by o->>'orderId'
    on conflict(order_id) do nothing returning order_id, status
  ) select coalesce(array_agg(order_id), '{}'), count(*) filter(where status='verified')
    into inserted_ids, preverified from inserted;
  update public.ryd_imports set new_count = cardinality(inserted_ids) where id = import_id;
  insert into public.ryd_order_events(order_id, action, detail, actor_id)
    select unnest(inserted_ids), 'imported', jsonb_build_object('filename', requested_payload->>'filename', 'import_id', import_id), requested_actor;
  result := jsonb_build_object('ok', true, 'rowCount', total, 'newCount', cardinality(inserted_ids),
    'existingCount', total - cardinality(inserted_ids), 'preverifiedCount', preverified,
    'duplicateCount', (requested_payload->>'duplicateCount')::integer);
  insert into public.ryd_write_receipts(operation_id, actor_id, kind, input_hash, result)
    values(requested_operation, requested_actor, 'import', fingerprint, result);
  return result;
end;
$function$;

create or replace function public.ryd_record_reminders(
  requested_actor uuid, requested_operation uuid, requested_targets jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  receipt public.ryd_write_receipts;
  fingerprint text;
  canonical jsonb;
  ids text[];
  marked_ids text[];
  sent_at timestamptz := clock_timestamp();
  result jsonb;
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_operation is null or jsonb_typeof(requested_targets) is distinct from 'array' then
    raise exception using errcode = 'RY400', message = 'Choose a valid reminder group.';
  end if;
  if jsonb_array_length(requested_targets) not between 1 and 100
    or exists(select 1 from jsonb_array_elements(requested_targets) t
      where jsonb_typeof(t->'orderId') is distinct from 'string'
        or char_length(t->>'orderId') not between 1 and 64
        or jsonb_typeof(t->'email') is distinct from 'string'
        or char_length(t->>'email') > 320
        or t->>'email' !~ '^[^[:space:]@,;<>?&#="]+@[^[:space:]@,;<>?&#="]+\.[^[:space:]@,;<>?&#="]+$')
    or jsonb_array_length(requested_targets) <> (select count(distinct t->>'orderId') from jsonb_array_elements(requested_targets) t) then
    raise exception using errcode = 'RY400', message = 'Confirm a group of up to 100 buyers with valid email addresses.';
  end if;
  select jsonb_agg(jsonb_build_object('orderId', t->>'orderId', 'email', lower(btrim(t->>'email'))) order by t->>'orderId'),
    array_agg(t->>'orderId' order by t->>'orderId') into canonical, ids
    from jsonb_array_elements(requested_targets) t;
  fingerprint := encode(sha256(convert_to(canonical::text, 'UTF8')), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-operation:' || requested_operation::text, 0));
  select * into receipt from public.ryd_write_receipts where operation_id = requested_operation;
  if found then
    if receipt.actor_id <> requested_actor or receipt.kind <> 'reminder' or receipt.input_hash <> fingerprint then
      raise exception using errcode = 'RY409', message = 'That operation was used for different content. Start a new upload or reminder.';
    end if;
    return receipt.result;
  end if;
  perform 1 from public.ryd_orders where order_id = any(ids) order by order_id for update;
  if exists(select 1 from public.ryd_orders o join jsonb_array_elements(canonical) t on o.order_id = t->>'orderId'
      where lower(btrim(o.email)) <> t->>'email') then
    raise exception using errcode = 'RY409', message = 'A buyer email changed after this draft was prepared. Review the group before recording it.';
  end if;
  with marked as (
    update public.ryd_orders set last_emailed_at = sent_at
      where order_id = any(ids) and status in ('pending','needs_info') and cleared_batch_id is null
      returning order_id, email
  ), events as (
    insert into public.ryd_order_events(order_id, action, detail, actor_id)
      select order_id, 'emailed', jsonb_build_object('to', email, 'operation_id', requested_operation), requested_actor from marked
  ) select coalesce(array_agg(order_id), '{}') into marked_ids from marked;
  result := jsonb_build_object('sentAt', sent_at, 'markedCount', cardinality(marked_ids),
    'skippedCount', cardinality(ids) - cardinality(marked_ids));
  insert into public.ryd_write_receipts(operation_id, actor_id, kind, input_hash, result)
    values(requested_operation, requested_actor, 'reminder', fingerprint, result);
  return result;
end;
$function$;

revoke all on function public.ryd_import_orders(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.ryd_record_reminders(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ryd_import_orders(uuid, uuid, jsonb) to service_role;
grant execute on function public.ryd_record_reminders(uuid, uuid, jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
