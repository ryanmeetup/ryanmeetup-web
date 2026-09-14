-- Record the fields behind a project update, and omit writes that changed no
-- project fields. Access has its own event, so an access-only update does not
-- masquerade as a second, generic project update.
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
    if old.archived_at is distinct from new.archived_at then
      resource_action := case
        when old.archived_at is null then 'project.archive'
        when new.archived_at is null then 'project.restore'
        else 'project.update'
      end;
    end if;
    if resource_action is null and cardinality(change_details) = 0 then
      return new;
    end if;
  end if;

  resource_action := coalesce(resource_action, case
    when tg_op = 'INSERT' then 'project.create'
    when tg_op = 'DELETE' then 'project.delete'
    else 'project.update'
  end);

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

drop trigger if exists log_project_workspace_activity on public.projects;
create trigger log_project_workspace_activity
after insert or update or delete on public.projects
for each row execute function public.log_project_workspace_activity();
