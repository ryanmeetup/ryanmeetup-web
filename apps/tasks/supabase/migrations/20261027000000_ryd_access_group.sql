-- RY-D is operated by a lateral team, with administrator tiers selected
-- explicitly so their higher tiers inherit access through the usual rules.
-- App owners keep their existing page override. No general workspace access
-- is granted to the RY-D team, and no members are enrolled automatically.
do $migration$
declare
  owner_id uuid;
  ryd_group_id uuid;
  ryd_group_kind public.access_group_kind;
begin
  select id into owner_id
  from public.profiles
  where app_role = 'owner' and onboarding_completed
  order by id
  limit 1;

  -- A database reset has no profiles yet. Leave the existing owner-only gate
  -- closed; an owner can create the team and select its page grant in Access.
  if owner_id is null then
    return;
  end if;

  insert into public.access_groups (name, description, color, kind, created_by)
  values (
    'RY-D',
    'Manage RY-D verification, fulfillment, settings, and the Google connection.',
    '#0d9488',
    'team',
    owner_id
  )
  on conflict (name) do nothing;

  select id, kind into ryd_group_id, ryd_group_kind
  from public.access_groups
  where name = 'RY-D';
  if ryd_group_kind <> 'team' then
    raise exception 'RY-D must be a lateral access team';
  end if;

  insert into public.workspace_area_access (area, access_mode, updated_by)
  values ('ryd', 'restricted', owner_id)
  on conflict (area) do update
    set access_mode = excluded.access_mode,
        updated_at = now(),
        updated_by = excluded.updated_by;

  delete from public.workspace_area_group_grants
  where area = 'ryd'
    and group_id not in (
      select id from public.access_groups
      where id = ryd_group_id or (kind = 'tier' and grants_global_content)
    );

  insert into public.workspace_area_group_grants (area, group_id, granted_by)
  select 'ryd', id, owner_id
  from public.access_groups
  where id = ryd_group_id or (kind = 'tier' and grants_global_content)
  on conflict (area, group_id) do nothing;
end;
$migration$;
