-- Favorites are shortcuts to current work. Remove a project from every
-- profile when it reaches Complete, regardless of which supported mutation
-- path changed the lifecycle status.
create or replace function public.remove_completed_project_from_favorites()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'complete' and old.status is distinct from new.status then
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

drop trigger if exists projects_remove_completed_favorites on public.projects;
create trigger projects_remove_completed_favorites
after update of status on public.projects
for each row
execute function public.remove_completed_project_from_favorites();

-- Repair favorites saved before completion became a lifecycle boundary.
update public.profiles profile
set favorite_project_ids = coalesce(
  (
    select array_agg(favorite_id order by ordinal)
    from unnest(profile.favorite_project_ids) with ordinality
      as favorite(favorite_id, ordinal)
    where not exists (
      select 1
      from public.projects project
      where project.id = favorite.favorite_id
        and project.status = 'complete'
    )
  ),
  '{}'::uuid[]
)
where exists (
  select 1
  from unnest(profile.favorite_project_ids) favorite_id
  join public.projects project on project.id = favorite_id
  where project.status = 'complete'
);

revoke all on function public.remove_completed_project_from_favorites() from public;
grant execute on function public.remove_completed_project_from_favorites()
  to authenticated, service_role;
