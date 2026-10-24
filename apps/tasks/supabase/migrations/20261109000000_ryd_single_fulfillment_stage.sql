-- Production runs in fulfillment's own system, so RY-D only tracks the
-- handoff: Ready to send → Sent to fulfillment → Done. `production_sent_at`
-- now records when an order was sent to fulfillment.
begin;

-- Date every sent order by its handoff. Orders whose production start was
-- confirmed later take the earlier send date instead. Safe to re-run.
update public.ryd_orders o
  set production_sent_at = b.sent_at,
    production_sent_by = b.sent_by
  from public.ryd_fulfillment_batches b
  where o.cleared_batch_id = b.id and o.status = 'verified'
    and (o.production_sent_at is null or o.production_sent_at > b.sent_at);

-- Older clients may still send `not-started` and `in-production`; read them
-- as Ready to send and Sent to fulfillment.
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
  handoff uuid;
  handoff_count integer;
begin
  perform public.ryd_require_operator(requested_actor);
  if jsonb_typeof(requested_moves) is distinct from 'array' then
    raise exception using errcode='RY400', message='Choose a valid production group.';
  end if;
  if jsonb_array_length(requested_moves) not between 1 and 100
    or exists(select 1 from jsonb_array_elements(requested_moves) m
      where jsonb_typeof(m->'orderId') is distinct from 'string'
        or char_length(m->>'orderId') not between 1 and 64
        or m->>'from' is null or m->>'from' not in ('not-started','ready-to-send','sent-to-fulfillment','in-production','done')
        or m->>'to' is null or m->>'to' not in ('not-started','ready-to-send','sent-to-fulfillment','in-production','done'))
    or jsonb_array_length(requested_moves) <> (select count(distinct m->>'orderId') from jsonb_array_elements(requested_moves) m) then
    raise exception using errcode='RY400', message='Choose up to 100 distinct orders and valid fulfillment stages.';
  end if;
  select jsonb_agg(m order by m->>'orderId'), array_agg(m->>'orderId' order by m->>'orderId')
    into canonical, ids
    from (select jsonb_build_object('orderId', e->>'orderId',
        'from', case e->>'from' when 'not-started' then 'ready-to-send' when 'in-production' then 'sent-to-fulfillment' else e->>'from' end,
        'to', case e->>'to' when 'not-started' then 'ready-to-send' when 'in-production' then 'sent-to-fulfillment' else e->>'to' end) m
      from jsonb_array_elements(requested_moves) e) moves;
  if exists(select 1 from jsonb_array_elements(canonical) m where m->>'from'=m->>'to') then
    raise exception using errcode='RY400', message='Choose up to 100 distinct orders and valid fulfillment stages.';
  end if;
  result := public.ryd_bulk_receipt(requested_actor, requested_operation, 'production', canonical);
  perform 1 from public.ryd_orders where order_id=any(ids) order by order_id for update;
  if result is null then
    if (select count(*) from public.ryd_orders where order_id=any(ids)) <> cardinality(ids)
      or exists(select 1 from public.ryd_orders o join jsonb_array_elements(canonical) m on o.order_id=m->>'orderId'
        where o.status <> 'verified' or m->>'from' <> case when o.done_at is not null then 'done'
          when o.production_sent_at is not null or o.cleared_batch_id is not null then 'sent-to-fulfillment'
          else 'ready-to-send' end) then
      raise exception using errcode='RY409', message='A selected order changed. Reload and review the remaining selection.';
    end if;
    for target in select distinct m->>'to' from jsonb_array_elements(canonical) m order by 1 loop
      select array_agg(m->>'orderId' order by m->>'orderId') into target_ids
        from jsonb_array_elements(canonical) m where m->>'to'=target;
      if target='sent-to-fulfillment' then
        select count(*) into handoff_count from public.ryd_orders
          where order_id=any(target_ids) and cleared_batch_id is null;
        handoff := null;
        if handoff_count > 0 then
          handoff := gen_random_uuid();
          -- Store only the manual stage change, never an email, CSV or draft.
          insert into public.ryd_fulfillment_batches(id,recipient,order_count,verified_count,sent_by)
            values(handoff,null,handoff_count,handoff_count,requested_actor);
        end if;
        update public.ryd_orders set cleared_batch_id=coalesce(cleared_batch_id,handoff),updated_at=clock_timestamp()
          where order_id=any(target_ids);
        -- Keeps an existing send date and clears done when moving back.
        perform public.ryd_set_production(requested_actor, target_ids, 'in-production');
        insert into public.ryd_order_events(order_id,action,detail,actor_id)
          select unnest(target_ids),'sent',jsonb_build_object('stage',target,'manual',true),requested_actor;
      elsif target='ready-to-send' then
        perform public.ryd_set_production(requested_actor, target_ids, 'not-started');
        update public.ryd_orders set cleared_batch_id=null,updated_at=clock_timestamp()
          where order_id=any(target_ids);
        insert into public.ryd_order_events(order_id,action,detail,actor_id)
          select unnest(target_ids),'production',jsonb_build_object('stage',target,'manual',true),requested_actor;
      else
        perform public.ryd_set_production(requested_actor, target_ids, 'done');
      end if;
    end loop;
    result := jsonb_build_object('movedCount', cardinality(ids));
    insert into public.ryd_write_receipts(operation_id,actor_id,kind,input_hash,result)
      values(requested_operation,requested_actor,'production',encode(sha256(convert_to(canonical::text,'UTF8')),'hex'),result);
  end if;
  -- Replays return current canonical state, without retaining customer rows in receipts.
  select coalesce(jsonb_agg(jsonb_build_object('orderId',order_id,'productionSentAt',production_sent_at,
    'doneAt',done_at,'updatedAt',updated_at,'sentToFulfillment',cleared_batch_id is not null) order by order_id),'[]') into saved
    from public.ryd_orders where order_id=any(ids);
  return result || jsonb_build_object('orders',saved);
end;
$function$;

notify pgrst, 'reload schema';
commit;
