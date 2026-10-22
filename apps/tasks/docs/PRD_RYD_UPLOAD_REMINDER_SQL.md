# PRD: optional RY-D reminder schema alignment

This is maintenance for schema parity, not a deployment prerequisite. Keep
RY-D disabled on PRD. Its disabled routes and cron do not use these tables.

For scheduled maintenance, run these complete blocks in the **PRD** Supabase
SQL Editor (`vjsnobmfsfrsnwukfaoq`), never RMT. First complete the earlier
[contract repair](PRD_RYD_CONTRACT_SQL.md), any missing
[submitter contacts](PRD_RYD_SUBMITTER_CONTACTS_SQL.md), and
[shared access predicate](PRD_RYD_READ_ACCESS_SQL.md).

The first block copies migration `20261103000000` with migration bookkeeping.
It includes the columns from `20261026000000` and supersedes that migration's
older recipient resolver. It preserves existing schedules, feature flags,
and access grants. It is safe to run again.

```sql
-- The upload-reminder migration predates the shared per-member access rule.
-- Backfilling it into a database already on 20261102000000 must not restore
-- its old missing-metadata/open recipient fallback.
begin;

alter table public.ryd_settings
  add column if not exists upload_reminder_enabled boolean not null default true,
  add column if not exists upload_reminder_weekday smallint not null default 2
    check (upload_reminder_weekday between 0 and 6),
  add column if not exists upload_reminder_hour smallint not null default 12
    check (upload_reminder_hour between 0 and 23),
  add column if not exists upload_reminder_sent_on date;

create or replace function public.workspace_area_members(requested_area text)
returns setof uuid language sql stable security definer set search_path = '' as $function$
  select profile.id from public.profiles profile
  where public.member_can_view_workspace_area(profile.id, requested_area);
$function$;
alter function public.workspace_area_members(text) owner to postgres;
revoke all on function public.workspace_area_members(text) from public, anon, authenticated;
grant execute on function public.workspace_area_members(text) to service_role;

insert into supabase_migrations.schema_migrations(version,name,statements)
values
  ('20261026000000','ryd_upload_reminder',array['-- Applied by the superseding upload-reminder dashboard handoff.']),
  ('20261103000000','ryd_upload_reminder_access',array['-- Applied from the committed dashboard handoff.'])
on conflict (version) do nothing;
notify pgrst, 'reload schema';
commit;
```

Then verify on **PRD**:

```sql
select
  (select count(*) = 4 from information_schema.columns
    where table_schema = 'public' and table_name = 'ryd_settings'
      and column_name in ('upload_reminder_enabled','upload_reminder_weekday',
        'upload_reminder_hour','upload_reminder_sent_on')) as reminder_columns_present,
  (select count(*) = 2 from supabase_migrations.schema_migrations
    where version in ('20261026000000','20261103000000')) as migrations_recorded,
  position('member_can_view_workspace_area' in
    pg_get_functiondef('public.workspace_area_members(text)'::regprocedure)) > 0
    as shared_access_rule,
  not has_function_privilege('anon','public.workspace_area_members(text)','execute')
    and not has_function_privilege('authenticated','public.workspace_area_members(text)','execute')
    and has_function_privilege('service_role','public.workspace_area_members(text)','execute')
    as private_recipient_resolver,
  not exists(select 1 from public.instance_settings where ryd_enabled is true)
    as ryd_disabled;
```

Expected: one row with all five values `true`. No customer rows are read and
no emails are sent by either block. RMT is applied and verified separately.
