-- RY-D Settings becomes its own lockable page, so someone can work the RY-D
-- queue without changing the review form, fulfillment's address, the upload
-- reminder, or the Google connection. Like RY-D it needs an explicit access
-- row: unconfigured, it is owner-only rather than open. It starts restricted to
-- exactly the groups RY-D grants today, so nobody's access changes until an
-- owner narrows it in /admin/access.
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
        or exists (
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
        )
        or (coalesce(requested_area, '') not in ('ryd', 'ryd-settings')
          and not public.member_is_guest(profile.id)
          and not exists (
            select 1 from public.workspace_area_access area_row
            where area_row.area = requested_area
          ))
      )
  );
$function$;

-- Seed once: a replay must not undo an owner's later narrowing.
do $seed$
begin
  if not exists (select 1 from public.workspace_area_access where area = 'ryd-settings') then
    insert into public.workspace_area_access (area, access_mode)
    values ('ryd-settings', 'restricted');
    insert into public.workspace_area_group_grants (area, group_id, granted_by)
    select 'ryd-settings', grant_row.group_id, grant_row.granted_by
    from public.workspace_area_group_grants grant_row
    where grant_row.area = 'ryd'
    on conflict do nothing;
  end if;
end;
$seed$;

commit;
