# PRD: fail-closed RY-D reads and reminder recipients

This is a schema-maintenance handoff. PRD does not need a healthy RY-D schema
for its enabled features or deployment while `ryd_enabled` is false or null.
Keep RY-D off there. See [feature availability versus schema alignment](MULTI_INSTANCE.md#the-two-tiers).

Run both SQL blocks below in the **PRD** Supabase dashboard SQL Editor for
`projects.ryanle.dev` (project `vjsnobmfsfrsnwukfaoq`). RMT is applied and
verified separately by the agent.

If the earlier health check still reports a missing `ryd_submitter_contacts`
table, first apply [its complete repair](PRD_RYD_SUBMITTER_CONTACTS_SQL.md).
The transaction updates in [the cumulative handoff](PRD_RYD_FULFILLMENT_SQL.md)
and the earlier contract diagnostic must already be installed.

This block copies migration `20261102000000_ryd_read_access.sql` in full and
records its version. It is safe to run again. It changes authorization functions
and deployment diagnostics, without changing customer rows or selected grants.
Missing RY-D metadata leaves access with onboarded app owners; an explicit
open setting or selected group is required for everyone else. Other pages
retain their unconfigured/open default. Reads, writes, and worker recipients
share a private per-member predicate; members can ask only about themselves.

```sql
-- RY-D contains service-role-only customer data. Missing page metadata must
-- not open reads or add reminder recipients. Other pages retain their legacy
-- unconfigured/open default. One predicate owns reads, writes, and recipients.
begin;

create or replace function public.member_can_view_workspace_area(requested_member uuid, requested_area text)
returns boolean language sql stable security definer set search_path = '' as $function$
  select exists (
    select 1 from public.profiles profile
    where profile.id = requested_member and profile.onboarding_completed
      and (
        profile.app_role = 'owner'
        or exists (
          select 1 from public.workspace_area_access area_row
          where area_row.area = requested_area
            and (area_row.access_mode = 'open' or (
              area_row.access_mode = 'restricted' and exists (
                select 1 from public.workspace_area_group_grants grant_row
                where grant_row.area = area_row.area
                  and public.member_has_group_access(profile.id, grant_row.group_id)
              )
            ))
        )
        or (requested_area is distinct from 'ryd' and not exists (
          select 1 from public.workspace_area_access area_row
          where area_row.area = requested_area
        ))
      )
  );
$function$;
alter function public.member_can_view_workspace_area(uuid,text) owner to postgres;
revoke all on function public.member_can_view_workspace_area(uuid,text) from public, anon, authenticated;
grant execute on function public.member_can_view_workspace_area(uuid,text) to service_role;

-- Signed-in callers may ask only about themselves. The per-member predicate
-- and recipient list remain private to the server.
create or replace function public.can_view_workspace_area(requested_area text)
returns boolean language sql stable security definer set search_path = '' as $function$
  select public.member_can_view_workspace_area(auth.uid(), requested_area);
$function$;
alter function public.can_view_workspace_area(text) owner to postgres;
revoke all on function public.can_view_workspace_area(text) from public, anon;
grant execute on function public.can_view_workspace_area(text) to authenticated, service_role;

create or replace function public.workspace_area_members(requested_area text)
returns setof uuid language sql stable security definer set search_path = '' as $function$
  select profile.id from public.profiles profile
  where public.member_can_view_workspace_area(profile.id, requested_area);
$function$;
alter function public.workspace_area_members(text) owner to postgres;
revoke all on function public.workspace_area_members(text) from public, anon, authenticated;
grant execute on function public.workspace_area_members(text) to service_role;

create or replace function public.ryd_require_operator(requested_actor uuid)
returns void language plpgsql security invoker set search_path = '' as $function$
begin
  if not exists (select 1 from public.instance_settings where ryd_enabled is true)
    or not public.member_can_view_workspace_area(requested_actor, 'ryd') then
    raise exception using errcode = '42501', message = 'RY-D access is required.';
  end if;
end;
$function$;
revoke all on function public.ryd_require_operator(uuid) from public, anon, authenticated;
grant execute on function public.ryd_require_operator(uuid) to service_role;

-- Keep deployment diagnostics current without reading customer rows.
-- Read-only deployment diagnostics. No customer rows, OAuth credentials, or
-- mutation RPCs are read/executed. Disabled instances need not call this RPC.
create or replace function public.ryd_contract_health()
returns jsonb language sql stable security invoker set search_path = '' as $function$
with required_tables(name, columns, primary_key) as (values
  ('ryd_settings','id,form_id,fulfillment_email,updated_at,updated_by','id'),
  ('ryd_google_integrations','id,encrypted_refresh_token,account_email,connected_by,connected_at,updated_at','id'),
  ('ryd_imports','id,filename,headers,row_count,new_count,uploaded_by,uploaded_at','id'),
  ('ryd_fulfillment_batches','id,recipient,order_count,verified_count,sent_by,sent_at','id'),
  ('ryd_orders','order_id,sales_order,ordered_at,first_name,last_name,email,contact_method,raw,first_import_id,import_position,status,note,decided_by,decided_at,cleared_batch_id,last_emailed_at,created_at,updated_at,production_sent_at,production_sent_by,done_at,done_by','order_id'),
  ('ryd_order_submissions','order_id,submission_key,source,linked_by,linked_at','order_id,submission_key'),
  ('ryd_order_events','id,order_id,action,detail,actor_id,created_at','id'),
  ('ryd_dismissed_submissions','submission_key,dismissed_by,dismissed_at','submission_key'),
  ('ryd_submitter_contacts','id,email,contacted_by,contacted_at','id'),
  ('ryd_fulfillment_snapshots','id,state,recipient,headers,order_rows,verified_ids,response_keys,form_id,prepared_by,prepared_at,finished_by,finished_at','id'),
  ('ryd_write_receipts','operation_id,actor_id,kind,input_hash,result,completed_at','operation_id')
), tables as (
  select r.*, pg_catalog.to_regclass('public.' || r.name) as oid from required_tables r
), required_rpcs(signature, service_callable) as (values
  ('member_can_view_workspace_area(uuid,text)',true),
  ('workspace_area_members(text)',true),
  ('ryd_require_operator(uuid)',true),
  ('ryd_change_submission(uuid,text,text,text,text,text)',true),
  ('ryd_review_order(uuid,text,jsonb,text,text[])',true),
  ('ryd_set_production(uuid,text[],text)',true),
  ('ryd_prepare_fulfillment(uuid)',true),
  ('ryd_finish_fulfillment(uuid,uuid,text)',true),
  ('ryd_import_orders(uuid,uuid,jsonb)',true),
  ('ryd_record_reminders(uuid,uuid,jsonb)',true),
  ('ryd_bulk_receipt(uuid,uuid,text,jsonb)',true),
  ('ryd_move_production(uuid,uuid,jsonb)',true),
  ('ryd_record_contacts(uuid,uuid,text[])',true),
  ('ryd_link_submissions(uuid,text,text[],text,text)',true),
  ('ryd_guard_form_change()',false),
  ('ryd_guard_reserved_order()',false),
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
  ('ryd_write_receipts','ryd_write_receipts_kind_check', $$CHECK ((kind = ANY (ARRAY['import'::text, 'reminder'::text, 'production'::text, 'contact'::text])))$$)
), required_indexes(tab, name, definition) as (values
  ('ryd_order_submissions','ryd_order_submissions_one_order_idx', $$CREATE UNIQUE INDEX ryd_order_submissions_one_order_idx ON public.ryd_order_submissions USING btree (submission_key)$$),
  ('ryd_fulfillment_snapshots','ryd_fulfillment_one_prepared_idx', $$CREATE UNIQUE INDEX ryd_fulfillment_one_prepared_idx ON public.ryd_fulfillment_snapshots USING btree ((true)) WHERE (state = 'prepared'::text)$$)
), required_triggers(tab, name, signature, events) as (values
  ('ryd_settings','ryd_guard_form_change','ryd_guard_form_change()',19),
  ('ryd_orders','ryd_guard_reserved_order','ryd_guard_reserved_order()',27),
  ('ryd_order_submissions','ryd_guard_reserved_evidence','ryd_guard_reserved_order()',31)
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
revoke all on function public.ryd_contract_health() from public, anon, authenticated;
grant execute on function public.ryd_contract_health() to service_role;

insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20261102000000','ryd_read_access',array['-- Applied from the committed dashboard handoff.'])
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
```

Then run this on **PRD**:

```sql
select public.ryd_contract_health() as health,
  exists(select 1 from supabase_migrations.schema_migrations where version='20261102000000') as migration_recorded;
```

Expected: one row with `health = {"contractOk": true, "failures": []}` and
`migration_recorded = true`. The health check now requires the private access
predicate and recipient resolver as well as the earlier schema. Keep the
normal build preflight enabled. This result verifies schema health; it does
not verify real Google consent, Drive files, or Sheets writes.
