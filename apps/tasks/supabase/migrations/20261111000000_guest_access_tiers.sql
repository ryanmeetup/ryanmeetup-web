-- Guest tiers: an organizational tier for people outside the organization,
-- such as a fulfillment partner who works one page. A guest reaches only what
-- is granted to their own tier or to a team they belong to. Every rule that
-- opens content to "every onboarded member" skips them: open projects, open
-- categories, projectless tasks, unconfigured or open pages, and the member
-- directory. Tier inheritance does not cross the guest boundary in either
-- direction, so a guest never inherits a lower tier's grants and no other tier
-- inherits a guest tier's.
begin;

alter table public.access_groups
  add column if not exists guest boolean not null default false;

comment on column public.access_groups.guest is
  'Members of this tier reach only content granted to it or to their teams; open-to-everyone rules skip them.';

alter table public.access_groups
  drop constraint if exists access_groups_guest_shape;
alter table public.access_groups
  add constraint access_groups_guest_shape check (
    not guest or (kind = 'tier' and not grants_global_content and not is_default)
  );

-- About any member. Service-role only, so members cannot probe others.
create or replace function public.member_is_guest(requested_member uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.access_group_members membership
    join public.access_groups member_tier on member_tier.id = membership.group_id
    where membership.profile_id = requested_member
      and member_tier.kind = 'tier'
      and member_tier.guest
  );
$function$;

revoke all on function public.member_is_guest(uuid) from public, anon, authenticated;
grant execute on function public.member_is_guest(uuid) to service_role;

-- About the caller only; the app uses it to shape navigation.
create or replace function public.is_guest()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select auth.uid() is not null and public.member_is_guest(auth.uid());
$function$;

revoke all on function public.is_guest() from public, anon;
grant execute on function public.is_guest() to authenticated, service_role;

-- The gate on every "open to every onboarded member" rule.
create or replace function public.can_view_open_content()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.is_team_member() and not public.member_is_guest(auth.uid());
$function$;

revoke all on function public.can_view_open_content() from public, anon;
grant execute on function public.can_view_open_content() to authenticated, service_role;

create or replace function public.member_has_group_access(requested_profile_id uuid, requested_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.access_groups requested_group
    where requested_group.id = requested_group_id
      and (
        (requested_group.kind = 'team' and exists (
          select 1 from public.access_group_members membership
          where membership.profile_id = requested_profile_id
            and membership.group_id = requested_group.id
        ))
        or
        (requested_group.kind = 'tier' and exists (
          select 1
          from public.access_group_members membership
          join public.access_groups member_tier on member_tier.id = membership.group_id
          where membership.profile_id = requested_profile_id
            and member_tier.kind = 'tier'
            and (
              member_tier.id = requested_group.id
              or (
                not member_tier.guest
                and not requested_group.guest
                and member_tier.hierarchy_rank >= requested_group.hierarchy_rank
              )
            )
        ))
      )
  );
$function$;

create or replace function public.project_permission_for(requested_project_id uuid)
returns public.project_permission
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when not public.is_team_member() then null::public.project_permission
    when public.has_global_content_access(auth.uid()) then 'manager'::public.project_permission
    when exists (
      select 1 from public.project_owners owner_row
      where owner_row.project_id = requested_project_id
        and owner_row.profile_id = auth.uid()
    ) then 'manager'::public.project_permission
    when public.can_view_open_content() and exists (
      select 1 from public.projects project
      where project.id = requested_project_id
        and project.access_mode = 'open'
    ) then 'editor'::public.project_permission
    when exists (
      select 1 from public.project_group_grants grant_row
      where grant_row.project_id = requested_project_id
        and public.member_has_group_access(auth.uid(), grant_row.group_id)
    ) then 'editor'::public.project_permission
    else null::public.project_permission
  end;
$function$;

create or replace function public.can_assign_to_project(requested_profile_id uuid, requested_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.is_app_owner() or exists (
    select 1
    from public.profiles profile
    where profile.id = requested_profile_id
      and profile.onboarding_completed
      and (
        (requested_project_id is null and not public.member_is_guest(profile.id))
        or public.has_global_content_access(profile.id)
        or exists (
          select 1 from public.project_owners owner_row
          where owner_row.project_id = requested_project_id
            and owner_row.profile_id = profile.id
        )
        or (not public.member_is_guest(profile.id) and exists (
          select 1 from public.projects project
          where project.id = requested_project_id
            and project.access_mode = 'open'
        ))
        or exists (
          select 1 from public.project_group_grants grant_row
          where grant_row.project_id = requested_project_id
            and public.member_has_group_access(profile.id, grant_row.group_id)
        )
      )
  );
$function$;

create or replace function public.can_access_category(requested_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.has_global_content_access(auth.uid())
    or exists (
      select 1
      from public.work_groups category
      where category.id = requested_category_id
        and (
          (category.access_mode = 'open' and public.can_view_open_content())
          or exists (
            select 1
            from public.category_group_grants grant_row
            where grant_row.category_id = category.id
              and public.member_has_group_access(auth.uid(), grant_row.group_id)
          )
        )
    );
$function$;

create or replace function public.can_view_task(requested_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (
    case
      when task_row.project_id is null then public.can_view_open_content()
      else public.can_view_project(task_row.project_id)
    end
  ) and public.can_access_task_categories(task_row.id)
  from public.tasks task_row
  where task_row.id = requested_task_id;
$function$;

create or replace function public.can_edit_task(requested_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select (
    case
      when task_row.project_id is null then public.can_view_open_content()
      else public.can_edit_project(task_row.project_id)
    end
  ) and public.can_access_task_categories(task_row.id)
  from public.tasks task_row
  where task_row.id = requested_task_id;
$function$;

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
        or (requested_area is distinct from 'ryd'
          and not public.member_is_guest(profile.id)
          and not exists (
            select 1 from public.workspace_area_access area_row
            where area_row.area = requested_area
          ))
      )
  );
$function$;

create or replace function public.can_view_workspace_calendar()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.can_view_workspace_area('calendar') and (
    public.is_app_owner()
    or exists (
      select 1
      from public.access_group_members membership
      join public.access_groups access_group
        on access_group.id = membership.group_id
      where membership.profile_id = auth.uid()
        and access_group.calendar_access
    )
    or exists (
      select 1
      from public.access_group_members membership
      join public.access_groups member_tier
        on member_tier.id = membership.group_id
       and member_tier.kind = 'tier'
       and not member_tier.guest
      join public.access_groups granted_tier
        on granted_tier.kind = 'tier'
       and not granted_tier.guest
       and granted_tier.calendar_access
       and granted_tier.hierarchy_rank <= member_tier.hierarchy_rank
      where membership.profile_id = auth.uid()
    )
  );
$function$;

create or replace function public.set_default_access_tier(requested_group_id uuid)
returns public.access_groups
language plpgsql
security definer
set search_path to ''
as $function$
declare
  saved_group public.access_groups;
begin
  if not public.is_app_owner() then
    raise exception 'Only app owners may change the default tier'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.access_groups
    where id = requested_group_id and kind = 'tier'
  ) then
    raise exception 'The requested access group is not a tier'
      using errcode = 'RS001';
  end if;
  if exists (
    select 1 from public.access_groups
    where id = requested_group_id and guest
  ) then
    raise exception 'A guest tier cannot be the default for new members'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public.access_groups.default_tier', 0)
  );
  update public.access_groups
  set is_default = false
  where is_default and id <> requested_group_id;
  update public.access_groups
  set is_default = true
  where id = requested_group_id
  returning * into saved_group;

  return saved_group;
end;
$function$;

-- Projectless tasks are open to every non-guest member.
drop policy if exists "members view accessible tasks" on public.tasks;
create policy "members view accessible tasks" on public.tasks
for select using (
  case
    when project_id is null then (select public.can_view_open_content())
    else project_id in (select projects.id from public.projects)
  end
  and (
    (select public.is_app_owner())
    or not (id in (select public.tasks_with_unreachable_categories()))
  )
);

drop policy if exists "editors create tasks" on public.tasks;
create policy "editors create tasks" on public.tasks
for insert with check (
  (select public.is_app_owner())
  or (
    ((project_id is null and (select public.can_view_open_content())) or public.can_edit_project(project_id))
    and created_by = (select auth.uid())
    and (assignee_id is null or public.can_assign_to_project(assignee_id, project_id))
  )
);

drop policy if exists "editors update tasks" on public.tasks;
create policy "editors update tasks" on public.tasks
for update using (public.can_edit_task(id))
with check (
  ((project_id is null and (select public.can_view_open_content())) or public.can_edit_project(project_id))
  and public.can_access_task_categories(id)
  and (assignee_id is null or public.can_assign_to_project(assignee_id, project_id))
);

-- The member directory and category ownership are for the organization.
-- A guest still reads their own profile through "members read own profile".
drop policy if exists "team reads profiles" on public.profiles;
create policy "team reads profiles" on public.profiles
for select using ((select public.can_view_open_content()));

drop policy if exists "members view category owner metadata" on public.category_owners;
create policy "members view category owner metadata" on public.category_owners
for select using ((select public.can_view_open_content()));

commit;
