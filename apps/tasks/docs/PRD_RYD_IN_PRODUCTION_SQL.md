# PRD: add the RY-D In production stage

Run both blocks in the **PRD** Supabase dashboard **SQL Editor**
(`vjsnobmfsfrsnwukfaoq`, `projects.ryanle.dev`), rather than RMT. RMT
receives this committed migration separately through the CLI.

This adds `production_started_at` and `production_started_by` to
`ryd_orders`, makes In production a real stage in `ryd_move_production`
between Sent to fulfillment and Done, and requires the new columns in
`ryd_contract_health`. Existing orders keep their stage: none has a
production start yet, so they stay Sent to fulfillment or Done. It is safe to
run again.

Source: `supabase/migrations/20261119000000_ryd_in_production_stage.sql`, with
its migration-history insert added before commit.

```sql
-- Bring back In production between Sent to fulfillment and Done:
-- Ready to send → Sent to fulfillment → In production → Done.
-- `production_sent_at` keeps the send date; `production_started_at` records
-- when fulfillment confirmed the order is being made. Done may follow either
-- of the middle stages, since not every order's production start is reported.
begin;

alter table public.ryd_orders
  add column if not exists production_started_at timestamptz,
  add column if not exists production_started_by uuid
    references public.profiles (id) on delete set null;

alter table public.ryd_orders
  drop constraint if exists ryd_orders_started_after_sent_check;
alter table public.ryd_orders
  add constraint ryd_orders_started_after_sent_check
  check (production_started_at is null or production_sent_at is not null);

-- Clearing production entirely also clears its start, which the constraint
-- above requires. Same signature as before, so existing grants carry over.
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
      production_started_at = case when next_sent is null then null else production_started_at end,
      production_started_by = case when next_sent is null then null else production_started_by end,
      done_by = case when next_done is null then null else coalesce(done_by, requested_actor) end,
      updated_at = clock_timestamp() where order_id = current_order.order_id;
    insert into public.ryd_order_events(order_id, action, detail, actor_id)
      values (current_order.order_id, 'production', jsonb_build_object('stage', requested_stage), requested_actor);
    changed_orders := changed_orders || to_jsonb(current_order.order_id);
  end loop;
  return jsonb_build_object('movedCount', jsonb_array_length(changed_orders), 'orderIds', changed_orders);
end;
$function$;

-- `in-production` is a stage again. Older clients may still send
-- `not-started`; read it as Ready to send.
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
        'from', case e->>'from' when 'not-started' then 'ready-to-send' else e->>'from' end,
        'to', case e->>'to' when 'not-started' then 'ready-to-send' else e->>'to' end) m
      from jsonb_array_elements(requested_moves) e) moves;
  if exists(select 1 from jsonb_array_elements(canonical) m
      where m->>'from'=m->>'to' or (m->>'to'='in-production' and m->>'from'='ready-to-send')) then
    raise exception using errcode='RY400', message='Choose up to 100 distinct orders and valid fulfillment stages.';
  end if;
  result := public.ryd_bulk_receipt(requested_actor, requested_operation, 'production', canonical);
  perform 1 from public.ryd_orders where order_id=any(ids) order by order_id for update;
  if result is null then
    if (select count(*) from public.ryd_orders where order_id=any(ids)) <> cardinality(ids)
      or exists(select 1 from public.ryd_orders o join jsonb_array_elements(canonical) m on o.order_id=m->>'orderId'
        where o.status <> 'verified' or m->>'from' <> case when o.done_at is not null then 'done'
          when o.production_started_at is not null then 'in-production'
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
        update public.ryd_orders set cleared_batch_id=coalesce(cleared_batch_id,handoff),
            production_started_at=null,production_started_by=null,updated_at=clock_timestamp()
          where order_id=any(target_ids);
        -- Keeps an existing send date and clears done when moving back.
        perform public.ryd_set_production(requested_actor, target_ids, 'in-production');
        insert into public.ryd_order_events(order_id,action,detail,actor_id)
          select unnest(target_ids),'sent',jsonb_build_object('stage',target,'manual',true),requested_actor;
      elsif target='in-production' then
        -- Keeps an existing start date and clears done when moving back.
        update public.ryd_orders set production_started_at=coalesce(production_started_at,clock_timestamp()),
            production_started_by=coalesce(production_started_by,requested_actor),
            done_at=null,done_by=null,updated_at=clock_timestamp()
          where order_id=any(target_ids);
        insert into public.ryd_order_events(order_id,action,detail,actor_id)
          select unnest(target_ids),'production',jsonb_build_object('stage',target,'manual',true),requested_actor;
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
    'productionStartedAt',production_started_at,'doneAt',done_at,'updatedAt',updated_at,
    'sentToFulfillment',cleared_batch_id is not null) order by order_id),'[]') into saved
    from public.ryd_orders where order_id=any(ids);
  return result || jsonb_build_object('orders',saved);
end;
$function$;

-- Production builds must also require the production start columns.
create or replace function public.ryd_contract_health()
returns jsonb
language sql
stable
set search_path to ''
as $function$
with required_tables(name, columns, primary_key) as (values
  ('ryd_settings','id,form_id,fulfillment_email,updated_at,updated_by','id'),
  ('ryd_google_integrations','id,encrypted_refresh_token,account_email,connected_by,connected_at,updated_at','id'),
  ('ryd_imports','id,filename,headers,row_count,new_count,uploaded_by,uploaded_at','id'),
  ('ryd_fulfillment_batches','id,recipient,order_count,verified_count,sent_by,sent_at','id'),
  ('ryd_orders','order_id,sales_order,ordered_at,first_name,last_name,email,contact_method,raw,first_import_id,import_position,status,note,decided_by,decided_at,cleared_batch_id,last_emailed_at,created_at,updated_at,production_sent_at,production_sent_by,production_started_at,production_started_by,done_at,done_by,card_first_name,card_last_name,card_location,card_ryan_since,card_saved_by,card_saved_at','order_id'),
  ('ryd_order_submissions','order_id,submission_key,source,linked_by,linked_at','order_id,submission_key'),
  ('ryd_order_events','id,order_id,action,detail,actor_id,created_at','id'),
  ('ryd_dismissed_submissions','submission_key,dismissed_by,dismissed_at','submission_key'),
  ('ryd_submitter_contacts','id,email,contacted_by,contacted_at','id'),
  ('ryd_fulfillment_snapshots','id,state,recipient,headers,order_rows,verified_ids,response_keys,form_id,prepared_by,prepared_at,finished_by,finished_at','id'),
  ('ryd_write_receipts','operation_id,actor_id,kind,input_hash,result,completed_at','operation_id'),
  ('ryd_card_batches','id,order_count,created_by,created_at','id'),
  ('ryd_card_batch_orders','batch_id,order_id,position,first_name,last_name,location,ryan_since','batch_id,order_id')
), tables as (
  select r.*, pg_catalog.to_regclass('public.' || r.name) as oid from required_tables r
), required_rpcs(signature, service_callable) as (values
  ('member_can_view_workspace_area(uuid,text)',true),
  ('workspace_area_members(text)',true),
  ('ryd_require_operator(uuid)',true),
  ('ryd_change_submission(uuid,text,text,text,text,text)',true),
  ('ryd_review_order(uuid,text,jsonb,text,text[])',true),
  ('ryd_review_orders(uuid,jsonb,text,text[])',true),
  ('ryd_set_production(uuid,text[],text)',true),
  ('ryd_fulfillment_is_ready(uuid)',true),
  ('ryd_generate_fulfillment(uuid,text[])',true),
  ('ryd_import_orders(uuid,uuid,jsonb)',true),
  ('ryd_record_reminders(uuid,uuid,jsonb)',true),
  ('ryd_bulk_receipt(uuid,uuid,text,jsonb)',true),
  ('ryd_move_production(uuid,uuid,jsonb)',true),
  ('ryd_record_contacts(uuid,uuid,text[])',true),
  ('ryd_link_submissions(uuid,text,text[],text,text)',true),
  ('ryd_card_complete(public.ryd_orders)',true),
  ('ryd_create_card_batch(uuid,uuid)',true),
  ('ryd_guard_form_change()',false),
  ('ryd_contract_health()',true)
), rpcs as (
  select r.*, pg_catalog.to_regprocedure('public.' || r.signature) as oid from required_rpcs r
), required_checks(tab, name, expression) as (values
  ('ryd_orders','ryd_orders_status_check', $$CHECK ((status = ANY (ARRAY['pending'::text, 'verified'::text, 'needs_info'::text, 'rejected'::text])))$$),
  ('ryd_orders','ryd_orders_done_after_production_check', $$CHECK (((done_at IS NULL) OR (production_sent_at IS NOT NULL)))$$),
  ('ryd_orders','ryd_orders_verified_production_check', $$CHECK (((production_sent_at IS NULL) OR (status = 'verified'::text)))$$),
  ('ryd_orders','ryd_orders_started_after_sent_check', $$CHECK (((production_started_at IS NULL) OR (production_sent_at IS NOT NULL)))$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_snapshots_state_check', $$CHECK ((state = ANY (ARRAY['prepared'::text, 'sent'::text, 'cancelled'::text])))$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_snapshots_check', $$CHECK (((state = 'prepared'::text) = (finished_at IS NULL)))$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_snapshots_check1', $$CHECK (((finished_at IS NULL) = (finished_by IS NULL)))$$),
  ('ryd_write_receipts','ryd_write_receipts_kind_check', $$CHECK ((kind = ANY (ARRAY['import'::text, 'reminder'::text, 'production'::text, 'contact'::text, 'card-batch'::text])))$$),
  ('ryd_orders','ryd_orders_card_shape', $$CHECK (((char_length(card_first_name) <= 80) AND (char_length(card_last_name) <= 80) AND (char_length(card_location) <= 120) AND (card_ryan_since ~ '^([0-9]{4})?$'::text)))$$)
), required_indexes(tab, name, definition) as (values
  ('ryd_order_submissions','ryd_order_submissions_one_order_idx', $$CREATE UNIQUE INDEX ryd_order_submissions_one_order_idx ON public.ryd_order_submissions USING btree (submission_key)$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_one_prepared_idx', $$CREATE UNIQUE INDEX ryd_fulfillment_one_prepared_idx ON public.ryd_fulfillment_snapshots USING btree ((true)) WHERE (state = 'prepared'::text)$$)
), required_triggers(tab, name, signature, events) as (values
  ('ryd_settings','ryd_guard_form_change','ryd_guard_form_change()',19)
), failures(message) as (
  select 'Missing table: ' || t.name from tables t where t.oid is null
  union all
  select 'Missing column: ' || t.name || '.' || col.name from tables t
  cross join lateral pg_catalog.unnest(pg_catalog.string_to_array(t.columns, ',')) col(name)
  where not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid=t.oid and a.attname=col.name and a.attnum>0 and not a.attisdropped)
  union all
  select 'Unsafe table access: ' || t.name from tables t
  where t.oid is not null and (
    not exists(select 1 from pg_catalog.pg_class c where c.oid=t.oid and c.relkind='r' and c.relrowsecurity)
    or exists(select 1 from pg_catalog.pg_policy p where p.polrelid=t.oid)
    or exists(select 1 from pg_catalog.unnest(array['anon','authenticated']) role(name)
      where pg_catalog.has_table_privilege(role.name,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or pg_catalog.has_any_column_privilege(role.name,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
    or exists(select 1 from pg_catalog.unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege(name)
      where not pg_catalog.has_table_privilege('service_role',t.oid,privilege.name)))
  union all
  select 'Missing primary key: ' || t.name from tables t where not exists
    (select 1 from pg_catalog.pg_constraint c where c.conrelid=t.oid and c.contype='p' and c.convalidated
      and (select pg_catalog.string_agg(a.attname,',' order by k.position)
        from pg_catalog.unnest(c.conkey) with ordinality k(number,position)
        join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.number)=t.primary_key)
  union all
  select 'Unsafe or missing RPC: ' || r.signature from rpcs r
  where r.oid is null or pg_catalog.has_function_privilege('anon',r.oid,'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated',r.oid,'EXECUTE')
    or (r.service_callable and not pg_catalog.has_function_privilege('service_role',r.oid,'EXECUTE'))
    or not exists(select 1 from pg_catalog.pg_proc p where p.oid=r.oid and p.proconfig @> array['search_path=""'])
  union all
  select 'Missing or changed constraint: ' || r.name from required_checks r where not exists
    (select 1 from pg_catalog.pg_constraint c where c.conrelid=pg_catalog.to_regclass('public.'||r.tab)
      and c.conname=r.name and c.contype='c' and c.convalidated and pg_catalog.pg_get_constraintdef(c.oid)=r.expression)
  union all
  select 'Missing or changed unique index: ' || r.name from required_indexes r where not exists
    (select 1 from pg_catalog.pg_index i where i.indrelid=pg_catalog.to_regclass('public.'||r.tab)
      and i.indexrelid=pg_catalog.to_regclass('public.'||r.name) and i.indisunique and i.indisvalid and i.indisready
      and pg_catalog.pg_get_indexdef(i.indexrelid)=r.definition)
  union all
  select 'Missing or disabled trigger: ' || r.name from required_triggers r where not exists
    (select 1 from pg_catalog.pg_trigger t where t.tgrelid=pg_catalog.to_regclass('public.'||r.tab)
      and t.tgname=r.name and t.tgfoid=pg_catalog.to_regprocedure('public.'||r.signature)
      and t.tgenabled in ('O','A') and t.tgtype=r.events and not t.tgisinternal)
  union all
  select 'Missing RY-D page access metadata' where not exists
    (select 1 from public.workspace_area_access where area='ryd' and access_mode in ('open','restricted'))
)
select pg_catalog.jsonb_build_object('contractOk',count(*)=0,'failures',coalesce(pg_catalog.jsonb_agg(message order by message),'[]'::jsonb)) from failures;
$function$;

insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20261119000000','ryd_in_production_stage',array['-- Applied from the committed dashboard handoff.'])
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
```

Then run this separate verification query on **PRD**:

```sql
select
  exists(select 1 from supabase_migrations.schema_migrations where version='20261119000000') as recorded,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='ryd_orders'
      and column_name in ('production_started_at','production_started_by')) as new_columns,
  public.ryd_contract_health() as health;
```

Expected: one row with `recorded = true`, `new_columns = 2`, and
`health = {"contractOk": true, "failures": []}`.
