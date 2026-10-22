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

commit;
