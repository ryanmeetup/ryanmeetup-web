-- Personal filter presets. These rows never grant access to workspace content.
create table if not exists public.saved_task_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  settings jsonb not null check (jsonb_typeof(settings) = 'object' and settings @> '{"version":1}'::jsonb and jsonb_typeof(settings -> 'filters') = 'object' and octet_length(settings::text) <= 65536),
  created_at timestamptz not null default now()
);

create unique index if not exists saved_task_views_profile_name
  on public.saved_task_views (profile_id, lower(name));

alter table public.saved_task_views enable row level security;
revoke all on public.saved_task_views from anon, authenticated;
grant select, insert, update, delete on public.saved_task_views to authenticated;
grant all on public.saved_task_views to service_role;

drop policy if exists "members manage own saved task views" on public.saved_task_views;
create policy "members manage own saved task views" on public.saved_task_views
  for all to authenticated
  using (profile_id = (select auth.uid()) and (select public.is_team_member()))
  with check (profile_id = (select auth.uid()) and (select public.is_team_member()));
