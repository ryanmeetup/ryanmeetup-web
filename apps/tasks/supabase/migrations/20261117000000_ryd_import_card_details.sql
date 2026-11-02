-- Orders first imported from fulfillment's order summary have no Options
-- Detail, so their cards draft from the billing name. A later full export that
-- includes the same order now fills that detail in, unless the card was saved.
-- Everything else is unchanged from 20261030000000.
begin;

create or replace function public.ryd_import_orders(
  requested_actor uuid, requested_operation uuid, requested_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  receipt public.ryd_write_receipts;
  fingerprint text;
  import_id uuid := gen_random_uuid();
  inserted_ids text[];
  filled_ids text[];
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
  -- An order first imported from the order summary has no Options Detail, so
  -- its card drafts from the billing name. When a later full export carries
  -- one, take it, unless someone already saved the card.
  with uploaded as (
    select o->>'orderId' as order_id, d.key, d.value
    from jsonb_array_elements(requested_payload->'orders') o
    cross join lateral jsonb_each(o->'raw') d
    where lower(btrim(d.key)) = 'options detail' and btrim(d.value #>> '{}') <> ''
      and not (o->>'orderId' = any(inserted_ids))
  ), filled as (
    update public.ryd_orders r
      set raw = (select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(r.raw) e(k, v)
          where lower(btrim(k)) <> 'options detail') || jsonb_build_object(u.key, u.value),
        updated_at = clock_timestamp()
      from uploaded u
      where r.order_id = u.order_id
        and r.card_first_name is null and r.card_last_name is null
        and r.card_location is null and r.card_ryan_since is null
        and not exists (select 1 from jsonb_each_text(r.raw) e
          where lower(btrim(e.key)) = 'options detail' and btrim(e.value) <> '')
      returning r.order_id
  ) select coalesce(array_agg(order_id), '{}') into filled_ids from filled;
  update public.ryd_imports set new_count = cardinality(inserted_ids) where id = import_id;
  insert into public.ryd_order_events(order_id, action, detail, actor_id)
    select unnest(inserted_ids), 'imported', jsonb_build_object('filename', requested_payload->>'filename', 'import_id', import_id), requested_actor;
  insert into public.ryd_order_events(order_id, action, detail, actor_id)
    select unnest(filled_ids), 'imported', jsonb_build_object('filename', requested_payload->>'filename',
      'import_id', import_id, 'cardDetails', true), requested_actor;
  result := jsonb_build_object('ok', true, 'rowCount', total, 'newCount', cardinality(inserted_ids),
    'existingCount', total - cardinality(inserted_ids), 'preverifiedCount', preverified,
    'duplicateCount', (requested_payload->>'duplicateCount')::integer,
    'cardDetailsCount', cardinality(filled_ids));
  insert into public.ryd_write_receipts(operation_id, actor_id, kind, input_hash, result)
    values(requested_operation, requested_actor, 'import', fingerprint, result);
  return result;
end;
$function$;

revoke all on function public.ryd_import_orders(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ryd_import_orders(uuid, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
