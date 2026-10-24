-- Closing a project puts it away. Archive used to be a second, separate step
-- after Complete or Dropped, and the two disagreed about where a finished
-- project still appeared. The status is now the only switch: a project is
-- closed exactly when its status is Complete or Dropped, and `closed_at`
-- records when that happened so its timeline stops counting.
--
-- Safe to re-run: every step checks the state it leaves behind.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'archived_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'closed_at'
  ) then
    alter table public.projects rename column archived_at to closed_at;
  end if;
end;
$$;

comment on column public.projects.closed_at is
  'When the project became Complete or Dropped; null while it is open.';

-- Deployments built before this migration still select `archived_at` by name.
-- Mirror it read-only so they keep loading until the new build replaces them;
-- a later migration drops it once both instances run code that reads
-- `closed_at`.
alter table public.projects
add column if not exists archived_at timestamptz
generated always as (closed_at) stored;

comment on column public.projects.archived_at is
  'Deprecated read-only mirror of closed_at for deployments built before it.';

-- The backfill is housekeeping, not something a person did.
select set_config('app.suppress_workspace_activity', 'true', true);

-- A project archived while still open was put away without finishing, which
-- is what Dropped records.
update public.projects
set status = 'dropped'
where closed_at is not null
  and status not in ('complete', 'dropped');

-- A project closed without being archived has no recorded close time. Use the
-- latest logged change to its current status, then its latest logged change
-- of any kind, then its creation.
update public.projects project
set closed_at = coalesce(
  (
    select max(event.created_at)
    from public.permission_audit_events event
    where event.target_type = 'project'
      and event.target_id = project.id
      and event.after_state ->> 'detail'
        like '%Status: % → ' || initcap(project.status) || '%'
  ),
  (
    select max(event.created_at)
    from public.permission_audit_events event
    where event.target_type = 'project'
      and event.target_id = project.id
  ),
  project.created_at
)
where project.status in ('complete', 'dropped')
  and project.closed_at is null;

select set_config('app.suppress_workspace_activity', 'false', true);

create or replace function public.set_project_closed_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.status not in ('complete', 'dropped') then
    new.closed_at := null;
  elsif tg_op = 'UPDATE' and old.status in ('complete', 'dropped') then
    -- Complete → Dropped is a correction, not a second closing.
    new.closed_at := coalesce(old.closed_at, now());
  else
    new.closed_at := now();
  end if;
  return new;
end;
$function$;

revoke all on function public.set_project_closed_at() from public;

drop trigger if exists projects_set_closed_at on public.projects;
create trigger projects_set_closed_at
before insert or update on public.projects
for each row execute function public.set_project_closed_at();

alter table public.projects
drop constraint if exists projects_closed_at_matches_status;

alter table public.projects
add constraint projects_closed_at_matches_status
check ((status in ('complete', 'dropped')) = (closed_at is not null));

-- Status is the only way to close or reopen a project, so the archive key is
-- gone from updates.
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
      then (requested_values ->> 'dueDate')::date else due_date end
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

-- Closing is a status change and is logged as one. Earlier archive and restore
-- events keep their own labels in the activity feed.
create or replace function public.log_project_workspace_activity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  resource_action text;
  change_details text[] := '{}'::text[];
begin
  if coalesce(current_setting('app.suppress_workspace_activity', true), 'false') = 'true' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' then
    if old.name is distinct from new.name then
      change_details := array_append(change_details, format('Name: %s → %s', old.name, new.name));
    end if;
    if old.description is distinct from new.description then
      change_details := array_append(change_details, 'Description changed');
    end if;
    if old.links is distinct from new.links then
      change_details := array_append(change_details, 'Links changed');
    end if;
    if old.status is distinct from new.status then
      change_details := array_append(change_details, format(
        'Status: %s → %s', initcap(old.status), initcap(new.status)
      ));
    end if;
    if old.start_date is distinct from new.start_date then
      change_details := array_append(change_details, format(
        'Start date: %s → %s',
        coalesce(old.start_date::text, 'none'),
        coalesce(new.start_date::text, 'none')
      ));
    end if;
    if old.due_date is distinct from new.due_date then
      change_details := array_append(change_details, format(
        'Due date: %s → %s',
        coalesce(old.due_date::text, 'none'),
        coalesce(new.due_date::text, 'none')
      ));
    end if;
    if cardinality(change_details) = 0 then
      return new;
    end if;
  end if;

  resource_action := case
    when tg_op = 'INSERT' then 'project.create'
    when tg_op = 'DELETE' then 'project.delete'
    else 'project.update'
  end;

  insert into public.permission_audit_events (
    actor_id, action, target_type, target_id, before_state, after_state
  ) values (
    auth.uid(), resource_action, 'project',
    case when tg_op = 'DELETE' then old.id else new.id end,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'activity', true,
      'resource_name', case when tg_op = 'DELETE' then old.name else new.name end,
      'resource_href', '/projects',
      'project_id', case when tg_op = 'DELETE' then old.id else new.id end,
      'detail', nullif(array_to_string(change_details, '; '), '')
    ))
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

revoke all on function public.log_project_workspace_activity() from public;
