-- Some projects end without finishing. Dropped records that outcome
-- alongside Complete: both close the project, so it leaves the current
-- workspace and its favorites, but only Complete claims the work was done.

alter table public.projects
drop constraint if exists projects_status_check;

alter table public.projects
add constraint projects_status_check
check (status in ('discovery', 'queued', 'active', 'paused', 'complete', 'dropped'));

comment on column public.projects.status is
  'Project lifecycle: discovery, queued, active, paused, complete, or dropped.';

create or replace function public.create_project_with_visibility(
  requested_name text,
  requested_description text,
  requested_links jsonb,
  requested_owner_ids uuid[],
  requested_access_mode text,
  requested_group_ids uuid[],
  requested_status text,
  requested_start_date date,
  requested_due_date date
)
returns setof public.projects
language plpgsql
security definer
set search_path to ''
as $function$
declare
  project_row public.projects;
  normalized_owner_ids uuid[] := coalesce(requested_owner_ids, '{}'::uuid[]);
  normalized_group_ids uuid[] := coalesce(requested_group_ids, '{}'::uuid[]);
begin
  if not public.is_app_owner() then
    raise exception 'Only app owners may create projects' using errcode = '42501';
  end if;
  if cardinality(normalized_owner_ids) = 0 then
    raise exception 'A project requires at least one owner' using errcode = 'RS001';
  end if;
  if exists (
    select 1 from unnest(normalized_owner_ids) requested_owner_id
    where not exists (
      select 1 from public.profiles profile
      where profile.id = requested_owner_id and profile.onboarding_completed
    )
  ) then
    raise exception 'A selected project owner is not eligible' using errcode = 'RS001';
  end if;
  if requested_access_mode not in ('owners', 'open', 'restricted') then
    raise exception 'Invalid project visibility mode' using errcode = '22023';
  end if;
  if requested_status not in (
    'discovery', 'queued', 'active', 'paused', 'complete', 'dropped'
  ) then
    raise exception 'Invalid project status' using errcode = '22023';
  end if;
  if requested_start_date is not null
    and requested_due_date is not null
    and requested_due_date < requested_start_date
  then
    raise exception 'A project due date cannot fall before its start date'
      using errcode = 'RS001';
  end if;
  if requested_access_mode = 'restricted' and cardinality(normalized_group_ids) = 0 then
    raise exception 'Restricted projects require at least one access group'
      using errcode = 'RS001';
  end if;
  if requested_access_mode <> 'restricted' and cardinality(normalized_group_ids) > 0 then
    raise exception 'Only restricted projects may select access groups'
      using errcode = 'RS001';
  end if;
  if exists (
    select 1 from unnest(normalized_group_ids) requested_group_id
    where not exists (
      select 1 from public.access_groups access_group
      where access_group.id = requested_group_id
    )
  ) then
    raise exception 'An access group is not eligible for project visibility'
      using errcode = 'RS001';
  end if;

  insert into public.projects (
    name,
    description,
    links,
    created_by,
    access_mode,
    status,
    start_date,
    due_date
  ) values (
    requested_name,
    requested_description,
    requested_links,
    auth.uid(),
    requested_access_mode,
    requested_status,
    requested_start_date,
    requested_due_date
  ) returning * into project_row;

  insert into public.project_owners (project_id, profile_id)
  select project_row.id, requested_owner_id
  from (
    select distinct unnest(normalized_owner_ids) as requested_owner_id
  ) requested_owners;

  if requested_access_mode = 'restricted' then
    insert into public.project_group_grants (
      project_id,
      group_id,
      permission,
      granted_by
    )
    select
      project_row.id,
      requested_group_id,
      'editor'::public.project_permission,
      auth.uid()
    from (
      select distinct unnest(normalized_group_ids) as requested_group_id
    ) requested_groups;
  end if;

  return next project_row;
end;
$function$;

revoke all on function public.create_project_with_visibility(
  text, text, jsonb, uuid[], text, uuid[], text, date, date
) from public;
grant execute on function public.create_project_with_visibility(
  text, text, jsonb, uuid[], text, uuid[], text, date, date
) to authenticated, service_role;

-- Favorites are shortcuts to current work, so a closed project leaves them
-- whichever way it closed.
create or replace function public.remove_completed_project_from_favorites()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status in ('complete', 'dropped')
    and old.status is distinct from new.status
  then
    update public.profiles
    set favorite_project_ids = array_remove(
      favorite_project_ids,
      new.id
    )
    where new.id = any(favorite_project_ids);
  end if;

  return new;
end;
$function$;
