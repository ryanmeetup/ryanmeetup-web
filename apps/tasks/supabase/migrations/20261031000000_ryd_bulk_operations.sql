-- Bounded operations have private receipts; retrying cannot move a production
-- order back twice or count a contact attempt twice. Response groups link atomically.
begin;
alter table public.ryd_write_receipts drop constraint if exists ryd_write_receipts_kind_check;
alter table public.ryd_write_receipts add constraint ryd_write_receipts_kind_check
  check (kind in ('import', 'reminder', 'production', 'contact'));

create or replace function public.ryd_bulk_receipt(
  requested_actor uuid, requested_operation uuid, requested_kind text, requested_input jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare receipt public.ryd_write_receipts;
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_operation is null or requested_kind is null or requested_kind not in ('production', 'contact') then
    raise exception using errcode='RY400', message='Choose a valid operation.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-operation:' || requested_operation::text, 0));
  select * into receipt from public.ryd_write_receipts where operation_id=requested_operation;
  if found then
    if receipt.actor_id <> requested_actor or receipt.kind <> requested_kind
      or receipt.input_hash <> encode(sha256(convert_to(requested_input::text, 'UTF8')), 'hex') then
      raise exception using errcode='RY409', message='That operation was used for different content. Start a new operation.';
    end if;
    return receipt.result;
  end if;
  return null;
end;
$function$;

create or replace function public.ryd_move_production(
  requested_actor uuid, requested_operation uuid, requested_moves jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  canonical jsonb;
  ids text[];
  target text;
  target_ids text[];
  result jsonb;
  saved jsonb;
begin
  perform public.ryd_require_operator(requested_actor);
  if jsonb_typeof(requested_moves) is distinct from 'array' then
    raise exception using errcode='RY400', message='Choose a valid production group.';
  end if;
  if jsonb_array_length(requested_moves) not between 1 and 100
    or exists(select 1 from jsonb_array_elements(requested_moves) m
      where jsonb_typeof(m->'orderId') is distinct from 'string'
        or char_length(m->>'orderId') not between 1 and 64
        or m->>'from' is null or m->>'from' not in ('not-started','in-production','done')
        or m->>'to' is null or m->>'to' not in ('not-started','in-production','done')
        or m->>'from'=m->>'to')
    or jsonb_array_length(requested_moves) <> (select count(distinct m->>'orderId') from jsonb_array_elements(requested_moves) m) then
    raise exception using errcode='RY400', message='Choose up to 100 distinct orders and valid production stages.';
  end if;
  select jsonb_agg(m order by m->>'orderId'), array_agg(m->>'orderId' order by m->>'orderId')
    into canonical, ids from jsonb_array_elements(requested_moves) m;
  result := public.ryd_bulk_receipt(requested_actor, requested_operation, 'production', canonical);
  perform 1 from public.ryd_orders where order_id=any(ids) order by order_id for update;
  if result is null then
    if (select count(*) from public.ryd_orders where order_id=any(ids)) <> cardinality(ids)
      or exists(select 1 from public.ryd_orders o join jsonb_array_elements(canonical) m on o.order_id=m->>'orderId'
        where o.status <> 'verified' or m->>'from' <> case when o.done_at is not null then 'done'
          when o.production_sent_at is not null then 'in-production' else 'not-started' end) then
      raise exception using errcode='RY409', message='A selected order changed. Reload and review the remaining selection.';
    end if;
    for target in select distinct m->>'to' from jsonb_array_elements(canonical) m order by 1 loop
      select array_agg(m->>'orderId' order by m->>'orderId') into target_ids
        from jsonb_array_elements(canonical) m where m->>'to'=target;
      perform public.ryd_set_production(requested_actor, target_ids, target);
    end loop;
    result := jsonb_build_object('movedCount', cardinality(ids));
    insert into public.ryd_write_receipts(operation_id,actor_id,kind,input_hash,result)
      values(requested_operation,requested_actor,'production',encode(sha256(convert_to(canonical::text,'UTF8')),'hex'),result);
  end if;
  -- Replays return current canonical state, without retaining customer rows in receipts.
  select coalesce(jsonb_agg(jsonb_build_object('orderId',order_id,'productionSentAt',production_sent_at,
    'doneAt',done_at,'updatedAt',updated_at) order by order_id),'[]') into saved
    from public.ryd_orders where order_id=any(ids);
  return result || jsonb_build_object('orders',saved);
end;
$function$;

create or replace function public.ryd_record_contacts(
  requested_actor uuid, requested_operation uuid, requested_emails text[]
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  emails text[];
  email text;
  result jsonb;
  contacts jsonb;
  contacted_at timestamptz := clock_timestamp();
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_emails is null or cardinality(requested_emails) not between 1 and 100
    or exists(select 1 from unnest(requested_emails) e where e is null or char_length(e) > 320
      or e !~ '^[^[:space:]@,;<>?&#="]+@[^[:space:]@,;<>?&#="]+\.[^[:space:]@,;<>?&#="]+$') then
    raise exception using errcode='RY400', message='Confirm up to 100 valid contact addresses.';
  end if;
  select array_agg(e order by e) into emails from (select distinct lower(btrim(e)) e from unnest(requested_emails) e) normalized;
  result := public.ryd_bulk_receipt(requested_actor, requested_operation, 'contact', to_jsonb(emails));
  for email in select unnest(emails) loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-contact:' || email, 0));
  end loop;
  if result is null then
    insert into public.ryd_submitter_contacts(email,contacted_by,contacted_at)
      select unnest(emails),requested_actor,contacted_at;
    result := jsonb_build_object('markedCount',cardinality(emails),'contactedAt',contacted_at);
    insert into public.ryd_write_receipts(operation_id,actor_id,kind,input_hash,result)
      values(requested_operation,requested_actor,'contact',encode(sha256(convert_to(to_jsonb(emails)::text,'UTF8')),'hex'),result);
  end if;
  select coalesce(jsonb_object_agg(counts.email,jsonb_build_object('attempts',counts.attempts,'lastContactedAt',counts.last_contacted_at)),'{}')
    into contacts from (select c.email,count(*) attempts,max(c.contacted_at) last_contacted_at
      from public.ryd_submitter_contacts c where c.email=any(emails) group by c.email) counts;
  return result || jsonb_build_object('contacts',contacts);
end;
$function$;

create or replace function public.ryd_link_submissions(
  requested_actor uuid, requested_order text, requested_keys text[],
  requested_form text, requested_source text default 'manual'
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  key text;
  changed boolean := false;
  result jsonb;
begin
  perform public.ryd_require_operator(requested_actor);
  if requested_keys is null or cardinality(requested_keys) not between 1 and 100
    or exists(select 1 from unnest(requested_keys) k where k is null or char_length(k) not between 3 and 400) then
    raise exception using errcode='RY400', message='Link up to 100 valid responses together.';
  end if;
  -- Same lock order as review and single-response writes: settings, sorted keys, order.
  perform 1 from public.ryd_settings where id for share;
  for key in select distinct unnest(requested_keys) order by 1 loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-response:' || key, 0));
  end loop;
  perform 1 from public.ryd_orders where order_id=requested_order for update;
  for key in select distinct unnest(requested_keys) order by 1 loop
    result := public.ryd_change_submission(requested_actor,requested_order,key,'link',requested_form,requested_source);
    changed := changed or (result->>'changed')::boolean;
  end loop;
  return jsonb_build_object('ok',true,'changed',changed);
end;
$function$;

revoke all on function public.ryd_bulk_receipt(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.ryd_move_production(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.ryd_record_contacts(uuid,uuid,text[]) from public,anon,authenticated;
revoke all on function public.ryd_link_submissions(uuid,text,text[],text,text) from public,anon,authenticated;
grant execute on function public.ryd_bulk_receipt(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.ryd_move_production(uuid,uuid,jsonb) to service_role;
grant execute on function public.ryd_record_contacts(uuid,uuid,text[]) to service_role;
grant execute on function public.ryd_link_submissions(uuid,text,text[],text,text) to service_role;
notify pgrst,'reload schema';
commit;
