# PRD: bulk RY-D review transaction

Run the complete block below in the **PRD** Supabase dashboard **SQL Editor**
for `projects.ryanle.dev` (project `vjsnobmfsfrsnwukfaoq`), rather than RMT.
Keep RY-D disabled on PRD. This aligns its schema without enabling the feature.
All earlier committed migrations through `20261114000000` must already be
applied. The block creates no orders, reviews, or Google connections.

Source: `supabase/migrations/20261115000000_ryd_bulk_reviews.sql`, with the
migration-history insert added before commit. It is safe to run again.
RMT is applied separately through the CLI by the agent.

If the verification says the bulk RPC is installed but reports missing card
columns, card-batch tables, or the fulfillment readiness/generation RPCs, apply
[the card-contract repair](PRD_RYD_CARD_CONTRACT_REPAIR_SQL.md). That block repairs
the reported earlier schema gaps while retaining the newer bulk and access rules.

```sql
-- One provenance read and one transaction per bounded review group. Authored
-- per-order refusals roll back only that order; unexpected failures roll back
-- the whole request. Canonical single-order reviews own validation and audit.
begin;

create or replace function public.ryd_review_orders(
  requested_actor uuid, requested_decisions jsonb,
  requested_form text default null, requested_known_keys text[] default '{}'
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  decision jsonb;
  key text;
  keys text[];
  review jsonb;
  reviews jsonb := '[]';
  failures jsonb := '[]';
begin
  perform public.ryd_require_operator(requested_actor);
  if jsonb_typeof(requested_decisions) is distinct from 'array' then
    raise exception using errcode = 'RY400', message = 'Choose a valid review group.';
  end if;
  if jsonb_array_length(requested_decisions) not between 1 and 100
    or requested_known_keys is null or cardinality(requested_known_keys) > 10000
    or exists (select 1 from unnest(requested_known_keys) k
      where k is null or char_length(k) not between 3 and 400) then
    raise exception using errcode = 'RY400', message = 'Review up to 100 orders together.';
  end if;
  for decision in select value from jsonb_array_elements(requested_decisions) loop
    if jsonb_typeof(decision) is distinct from 'object' then
      raise exception using errcode = 'RY400', message = 'Choose a valid order decision.';
    end if;
    if exists (select 1 from jsonb_object_keys(decision) k
        where k not in ('orderId', 'status', 'expectedStatus', 'expectedUpdatedAt', 'card', 'submissionKeys'))
      or jsonb_typeof(decision->'orderId') is distinct from 'string'
      or char_length(btrim(decision->>'orderId')) not between 1 and 64
      or coalesce(decision->>'status', '') not in ('pending', 'verified', 'needs_info', 'rejected')
      or coalesce(decision->>'expectedStatus', '') not in ('pending', 'verified', 'needs_info', 'rejected')
      or (decision->>'status' = 'verified' and not decision ? 'card')
      or (decision->>'status' <> 'verified' and decision ? 'card') then
      raise exception using errcode = 'RY400', message = 'Choose a valid order decision.';
    end if;
    if decision ? 'submissionKeys' then
      if decision->>'status' <> 'verified'
        or jsonb_typeof(decision->'submissionKeys') is distinct from 'array' then
        raise exception using errcode = 'RY400', message = 'Only verification can accept suggested responses.';
      end if;
      if jsonb_array_length(decision->'submissionKeys') > 100
        or exists (select 1 from jsonb_array_elements(decision->'submissionKeys') k
          where jsonb_typeof(k) <> 'string' or char_length(k #>> '{}') not between 3 and 400) then
        raise exception using errcode = 'RY400', message = 'Choose up to 100 valid responses per order.';
      end if;
    end if;
  end loop;
  if jsonb_array_length(requested_decisions) <> (
    select count(distinct d->>'orderId') from jsonb_array_elements(requested_decisions) d
  ) then
    raise exception using errcode = 'RY400', message = 'Choose each order once.';
  end if;

  -- Match the single-review lock order, across the whole group: settings,
  -- sorted response keys, then sorted orders. No review acquires a new key later.
  perform 1 from public.ryd_settings where id for share;
  for key in select distinct k from jsonb_array_elements(requested_decisions) d
    cross join lateral jsonb_array_elements_text(coalesce(d->'submissionKeys', '[]')) k
    order by 1 loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ryd-response:' || key, 0));
  end loop;
  perform 1 from public.ryd_orders where order_id in (
    select d->>'orderId' from jsonb_array_elements(requested_decisions) d
  ) order by order_id for update;

  for decision in select value from jsonb_array_elements(requested_decisions) loop
    begin
      select coalesce(array_agg(distinct k order by k), '{}') into keys
        from jsonb_array_elements_text(coalesce(decision->'submissionKeys', '[]')) k;
      if exists (select 1 from unnest(keys) k where not k = any(requested_known_keys)) then
        raise exception using errcode = 'RY409',
          message = 'A response is no longer in the configured form. Refresh and choose it again.';
      end if;
      if exists (select 1 from public.ryd_orders where order_id = decision->>'orderId'
        and (cleared_batch_id is not null or production_sent_at is not null or done_at is not null)) then
        raise exception using errcode = 'RY409',
          message = 'This order is already with fulfillment or done. Its decision cannot be changed.';
      end if;
      review := public.ryd_review_order(requested_actor, decision->>'orderId',
        decision - 'orderId' - 'submissionKeys', requested_form, keys);
      -- The browser needs the canonical review fields, not the original CSV row.
      review := jsonb_set(review, '{order}', (review->'order') - 'raw');
      reviews := reviews || jsonb_build_array(jsonb_build_object('result', review, 'linkedKeys', keys));
    exception when sqlstate 'RY400' or sqlstate 'RY404' or sqlstate 'RY409' then
      failures := failures || jsonb_build_array(jsonb_build_object(
        'orderId', decision->>'orderId', 'message', sqlerrm));
    end;
  end loop;
  return jsonb_build_object('reviews', reviews, 'failures', failures);
end;
$function$;

revoke all on function public.ryd_review_orders(uuid,jsonb,text,text[]) from public, anon, authenticated;
grant execute on function public.ryd_review_orders(uuid,jsonb,text,text[]) to service_role;

-- Production builds must also require the new private batch review RPC.
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
  ('ryd_orders','order_id,sales_order,ordered_at,first_name,last_name,email,contact_method,raw,first_import_id,import_position,status,note,decided_by,decided_at,cleared_batch_id,last_emailed_at,created_at,updated_at,production_sent_at,production_sent_by,done_at,done_by,card_first_name,card_last_name,card_location,card_ryan_since,card_saved_by,card_saved_at','order_id'),
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
values ('20261115000000','ryd_bulk_reviews',array['-- Applied from the committed dashboard handoff.'])
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
```

Then run this separate verification query on **PRD**:

```sql
select
  to_regprocedure('public.ryd_review_orders(uuid,jsonb,text,text[])') is not null as installed,
  has_function_privilege('service_role','public.ryd_review_orders(uuid,jsonb,text,text[])','execute') as service_allowed,
  not has_function_privilege('anon','public.ryd_review_orders(uuid,jsonb,text,text[])','execute')
    and not has_function_privilege('authenticated','public.ryd_review_orders(uuid,jsonb,text,text[])','execute') as private_only,
  exists(select 1 from supabase_migrations.schema_migrations where version='20261115000000') as migration_recorded,
  public.ryd_contract_health() as health;
```

Expected: one row with `installed`, `service_allowed`, `private_only`, and
`migration_recorded` all `true`, and `health = {"contractOk": true, "failures": []}`.
A nonempty `failures` array names missing earlier schema or unsafe grants;
apply those earlier migrations before treating schema alignment as complete.
