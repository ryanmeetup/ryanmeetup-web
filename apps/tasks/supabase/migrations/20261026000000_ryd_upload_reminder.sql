-- A weekly nudge to upload fulfillment's RY-D orders. The slot lives on the
-- RY-D settings row, so changing the day or hour is an edit in RY-D Settings,
-- not a redeploy. An hourly worker emails everyone who can open the page when
-- the slot arrives, once per slot.

alter table public.ryd_settings
  add column if not exists upload_reminder_enabled boolean not null default true,
  add column if not exists upload_reminder_weekday smallint not null default 2
    check (upload_reminder_weekday between 0 and 6),
  add column if not exists upload_reminder_hour smallint not null default 12
    check (upload_reminder_hour between 0 and 23),
  -- The workspace-local date of the last slot the worker emailed for. Claimed
  -- before sending, so overlapping runs never send one slot twice.
  add column if not exists upload_reminder_sent_on date;

-- Who can open a page, for a worker with no signed-in user. The same rule as
-- `can_view_workspace_area`, evaluated per member instead of for `auth.uid()`;
-- change the two together. Service role only: it lists members.
create or replace function public.workspace_area_members(requested_area text)
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select profile.id
  from public.profiles profile
  where profile.onboarding_completed
    and (
      profile.app_role = 'owner'
      or not exists (
        select 1
        from public.workspace_area_access area_row
        where area_row.area = requested_area
          and area_row.access_mode = 'restricted'
      )
      or exists (
        select 1
        from public.workspace_area_group_grants grant_row
        where grant_row.area = requested_area
          and public.member_has_group_access(profile.id, grant_row.group_id)
      )
    );
$function$;

alter function public.workspace_area_members(text) owner to postgres;
revoke all on function public.workspace_area_members(text) from public, anon, authenticated;
grant execute on function public.workspace_area_members(text) to service_role;
