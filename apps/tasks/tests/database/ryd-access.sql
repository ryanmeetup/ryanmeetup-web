begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000101', 'ryd-owner@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000102', 'ryd-admin@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000103', 'ryd-higher@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000104', 'ryd-reviewer@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000105', 'ryd-member@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000106', 'ryd-incomplete@example.test', '{}');

set local session_replication_role = replica;
update public.profiles set app_role = 'member', onboarding_completed = true
where id::text like '00000000-0000-4000-8000-00000000010%';
update public.profiles set app_role = 'owner'
where id = '00000000-0000-4000-8000-000000000101';
update public.profiles set onboarding_completed = false
where id = '00000000-0000-4000-8000-000000000106';
set local session_replication_role = origin;

insert into public.access_groups
  (id, name, kind, hierarchy_rank, grants_global_content, created_by) values
  ('10000000-0000-4000-8000-000000000101', 'RY-D test administrators', 'tier', 2147483100, true,
   '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000102', 'RY-D test higher tier', 'tier', 2147483101, false,
   '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000103', 'RY-D test unrelated team', 'team', null, false,
   '00000000-0000-4000-8000-000000000101');
update public.workspace_area_access set access_mode = 'open' where area = 'ryd';
insert into public.workspace_area_group_grants (area, group_id)
values ('ryd', '10000000-0000-4000-8000-000000000103');

-- Exercise the actual migration on a provisioned workspace, including replay.
-- APPLY_RYD_ACCESS_MIGRATION
-- APPLY_RYD_ACCESS_MIGRATION

select is((select count(*) from public.access_groups where name = 'RY-D'), 1::bigint,
  'replaying the migration keeps one RY-D group');
select ok((select kind = 'team' and not grants_global_content and not calendar_access
  from public.access_groups where name = 'RY-D'), 'RY-D is a lateral team without wider authority');
select is((select access_mode from public.workspace_area_access where area = 'ryd'), 'restricted',
  'RY-D is restricted even if it was previously open');
select ok(exists(select 1 from public.workspace_area_group_grants g
  join public.access_groups a on a.id = g.group_id where g.area = 'ryd' and a.name = 'RY-D'),
  'the RY-D team has an explicit page grant');
select ok(exists(select 1 from public.workspace_area_group_grants
  where area = 'ryd' and group_id = '10000000-0000-4000-8000-000000000101'),
  'administrator tiers have an explicit page grant');
select ok(not exists(select 1 from public.workspace_area_group_grants
  where area = 'ryd' and group_id = '10000000-0000-4000-8000-000000000103'),
  'unrelated teams lose the old page grant');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select public.set_profile_access_tier('00000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000101');
select public.set_profile_access_tier('00000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000102');
select ok(public.can_view_workspace_area('ryd'), 'app owners retain RY-D access');

set local role postgres;
insert into public.access_group_members (group_id, profile_id, added_by)
select id, profile_id::uuid, '00000000-0000-4000-8000-000000000101'::uuid from public.access_groups
cross join (values ('00000000-0000-4000-8000-000000000104'),
  ('00000000-0000-4000-8000-000000000106')) as members(profile_id)
where name = 'RY-D';
insert into public.workspace_area_access (area, access_mode) values ('ryd-test-unrelated', 'restricted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select ok(public.can_view_workspace_area('ryd'), 'administrator tier members reach RY-D');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select ok(public.can_view_workspace_area('ryd'), 'higher tiers inherit the administrator page grant');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', true);
select ok(public.can_view_workspace_area('ryd'), 'RY-D members reach the page without app ownership');
select ok('ryd' = any(public.accessible_workspace_areas(array['ryd'])), 'navigation uses the same RY-D grant');
select ok(not public.can_view_workspace_area('ryd-test-unrelated'), 'RY-D grants no access to another restricted page');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000105', true);
select ok(not public.can_view_workspace_area('ryd'), 'ordinary members cannot reach RY-D');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000106', true);
select ok(not public.can_view_workspace_area('ryd'), 'incomplete onboarding denies RY-D even with membership');
select set_config('request.jwt.claim.sub', '', true);
select ok(not public.can_view_workspace_area('ryd'), 'a signed-out caller cannot reach RY-D');

set local role postgres;
delete from public.access_group_members where profile_id = '00000000-0000-4000-8000-000000000104'
  and group_id = (select id from public.access_groups where name = 'RY-D');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', true);
select ok(not public.can_view_workspace_area('ryd'), 'removing RY-D membership revokes access');

select * from finish();
rollback;
