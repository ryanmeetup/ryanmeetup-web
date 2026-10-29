-- RY-D Settings is a fixed rule rather than a page an owner configures: app
-- owners and members of a tier with workspace-wide content access open it, and
-- nobody else. A selected-group list could be widened by mistake, and a team or
-- a partner tier added to it would let someone outside leadership change the
-- review form, fulfillment's address, the upload reminder, or the Google
-- connection. Its access row and grants are dropped, and set_workspace_area_access
-- refuses to write new ones.
begin;

create or replace function public.member_can_view_workspace_area(requested_member uuid, requested_area text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.profiles profile
    where profile.id = requested_member and profile.onboarding_completed
      and (
        profile.app_role = 'owner'
        or (requested_area = 'ryd-settings'
          and public.has_global_content_access(profile.id))
        or (coalesce(requested_area, '') <> 'ryd-settings' and exists (
          select 1 from public.workspace_area_access area_row
          where area_row.area = requested_area
            and (
              (area_row.access_mode = 'open' and not public.member_is_guest(profile.id))
              or (area_row.access_mode = 'restricted' and exists (
                select 1 from public.workspace_area_group_grants grant_row
                where grant_row.area = area_row.area
                  and public.member_has_group_access(profile.id, grant_row.group_id)
              ))
            )
        ))
        or (coalesce(requested_area, '') not in ('ryd', 'ryd-settings')
          and not public.member_is_guest(profile.id)
          and not exists (
            select 1 from public.workspace_area_access area_row
            where area_row.area = requested_area
          ))
      )
  );
$function$;

create or replace function public.set_workspace_area_access(
  requested_area text,
  requested_access_mode text,
  requested_group_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  normalized_area text := btrim(coalesce(requested_area, ''));
  normalized_group_ids uuid[] := coalesce(requested_group_ids, '{}'::uuid[]);
begin
  if not public.is_app_owner() then
    raise exception 'Only app owners may change page access'
      using errcode = '42501';
  end if;
  if normalized_area = '' or char_length(normalized_area) > 40 then
    raise exception 'Invalid page' using errcode = 'RS001';
  end if;
  if normalized_area = 'ryd-settings' then
    raise exception 'RY-D Settings is limited to app owners and workspace-wide tiers'
      using errcode = 'RS001';
  end if;
  if requested_access_mode not in ('open', 'restricted') then
    raise exception 'Invalid page access mode' using errcode = 'RS001';
  end if;
  if exists (
    select 1
    from unnest(normalized_group_ids) requested_group_id
    where not exists (
      select 1 from public.access_groups where id = requested_group_id
    )
  ) then
    raise exception 'Invalid access group' using errcode = 'RS001';
  end if;

  insert into public.workspace_area_access (
    area, access_mode, updated_at, updated_by
  )
  values (normalized_area, requested_access_mode, now(), auth.uid())
  on conflict (area) do update
    set access_mode = excluded.access_mode,
        updated_at = now(),
        updated_by = auth.uid();

  delete from public.workspace_area_group_grants
  where area = normalized_area;

  if requested_access_mode = 'restricted' then
    insert into public.workspace_area_group_grants (area, group_id, granted_by)
    select normalized_area, requested_group_id, auth.uid()
    from (
      select distinct unnest(normalized_group_ids) requested_group_id
    ) requested_groups;
  end if;
end;
$function$;

-- The deployment contract no longer requires a RY-D Settings access row,
-- since the rule this migration fixes does not read one.
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

-- The grants cascade with the row. Nothing reads them once the rule is fixed.
delete from public.workspace_area_access where area = 'ryd-settings';

notify pgrst, 'reload schema';

commit;
