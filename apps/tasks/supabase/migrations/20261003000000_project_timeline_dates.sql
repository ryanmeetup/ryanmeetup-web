-- A project carries its own dates now. `created_at` records when the project
-- was added to this workspace, which is rarely the day the work actually
-- began, so `start_date` carries the real kickoff and `due_date` the day the
-- work is meant to land. Both are calendar dates rather than timestamps,
-- matching how tasks have always scheduled themselves: a project starts on a
-- day, not at an instant.

alter table public.projects
  add column if not exists start_date date,
  add column if not exists due_date date;

alter table public.projects
  add constraint projects_dates_check
  check (due_date is null or start_date is null or due_date >= start_date);

comment on column public.projects.start_date is
  'The day work on the project began. Null reads as created_at.';
comment on column public.projects.due_date is
  'The day the project is meant to be finished. Never before start_date.';

-- Creation takes the dates alongside the rest of the project. The older
-- signatures stay put: the workspace contract check still looks for the
-- original six-argument form.
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
    'discovery', 'queued', 'active', 'paused', 'complete'
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

-- Editing reads the dates out of the same values payload as the rest of the
-- fields. A present key with a null value clears the date; an absent key
-- leaves it alone.
create or replace function public.replace_project_owners_and_update(
  requested_project_id uuid,
  requested_values jsonb
)
returns setof public.projects
language plpgsql
security definer
set search_path to ''
as $function$
declare
  project_row public.projects;
  normalized_owner_ids uuid[];
  previous_owner_ids uuid[];
  owner_detail text;
begin
  if not public.can_manage_project(requested_project_id) then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  if requested_values ? 'ownerIds' then
    select coalesce(array_agg(value::uuid), '{}'::uuid[])
    into normalized_owner_ids
    from jsonb_array_elements_text(requested_values -> 'ownerIds');
    if cardinality(normalized_owner_ids) = 0 then
      raise exception 'A project requires at least one owner' using errcode = 'RS001';
    end if;
    if exists (
      select 1 from unnest(normalized_owner_ids) owner_id
      where not exists (
        select 1 from public.profiles profile
        where profile.id = owner_id and profile.onboarding_completed
      )
    ) then
      raise exception 'A selected project owner is not eligible' using errcode = 'RS001';
    end if;
  end if;

  update public.projects
  set
    name = case when requested_values ? 'name' then requested_values ->> 'name' else name end,
    description = case when requested_values ? 'description' then requested_values ->> 'description' else description end,
    links = case when requested_values ? 'links' then requested_values -> 'links' else links end,
    status = case when requested_values ? 'status' then requested_values ->> 'status' else status end,
    start_date = case when requested_values ? 'startDate'
      then (requested_values ->> 'startDate')::date else start_date end,
    due_date = case when requested_values ? 'dueDate'
      then (requested_values ->> 'dueDate')::date else due_date end,
    archived_at = case when requested_values ? 'archived' then
      case when (requested_values ->> 'archived')::boolean then now() else null end
      else archived_at end
  where id = requested_project_id
  returning * into project_row;

  if project_row.id is null then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  if normalized_owner_ids is not null then
    select coalesce(array_agg(profile_id), '{}'::uuid[])
    into previous_owner_ids
    from public.project_owners
    where project_id = requested_project_id;

    delete from public.project_owners where project_id = requested_project_id;
    insert into public.project_owners (project_id, profile_id)
    select requested_project_id, owner_id
    from (select distinct unnest(normalized_owner_ids) owner_id) owners;

    owner_detail := public.owner_change_detail(
      previous_owner_ids, normalized_owner_ids
    );
    if owner_detail is not null then
      insert into public.permission_audit_events (
        actor_id, action, target_type, target_id, before_state, after_state
      ) values (
        auth.uid(),
        'project.owners.update',
        'project',
        requested_project_id,
        null,
        jsonb_build_object(
          'activity', true,
          'resource_name', project_row.name,
          'resource_href', '/projects',
          'project_id', requested_project_id,
          'detail', owner_detail
        )
      );
    end if;
  end if;

  return next project_row;
end;
$function$;

revoke all on function public.replace_project_owners_and_update(uuid, jsonb) from public;
grant execute on function public.replace_project_owners_and_update(uuid, jsonb)
  to authenticated, service_role;
