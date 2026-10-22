begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

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
-- APPLY_RYD_READ_ACCESS_MIGRATION
-- APPLY_RYD_READ_ACCESS_MIGRATION
-- APPLY_RYD_UPLOAD_REMINDER_BACKFILL
-- APPLY_RYD_UPLOAD_REMINDER_BACKFILL

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

set local role postgres;
insert into public.instance_settings(id, ryd_enabled) values(true, true)
  on conflict(id) do update set ryd_enabled = true;
insert into public.access_group_members(group_id, profile_id, added_by)
select id, '00000000-0000-4000-8000-000000000104'::uuid,
  '00000000-0000-4000-8000-000000000101'::uuid
from public.access_groups where name='RY-D';

set local role anon;
select throws_ok($$select public.member_can_view_workspace_area('00000000-0000-4000-8000-000000000104','ryd')$$,
  '42501',null,'anonymous cannot probe another member access');
select throws_ok($$select public.workspace_area_members('ryd')$$,
  '42501',null,'anonymous cannot list recipients');
set local role authenticated;
select throws_ok($$select public.member_can_view_workspace_area('00000000-0000-4000-8000-000000000104','ryd')$$,
  '42501',null,'members cannot probe another member access');
select throws_ok($$select public.workspace_area_members('ryd')$$,
  '42501',null,'members cannot list recipients');

set local role service_role;
select results_eq(
  $$select id from public.workspace_area_members('ryd') id where id::text like '00000000-0000-4000-8000-00000000010%' order by id$$,
  $$values ('00000000-0000-4000-8000-000000000101'::uuid),('00000000-0000-4000-8000-000000000102'::uuid),('00000000-0000-4000-8000-000000000103'::uuid),('00000000-0000-4000-8000-000000000104'::uuid)$$,
  'restricted recipients include owners, selected tiers, inherited tiers, and the team only');
select lives_ok($$select public.ryd_require_operator('00000000-0000-4000-8000-000000000104')$$,
  'team member can still write with an explicit grant');
select ok(not public.member_can_view_workspace_area(null,'ryd'),'null identity cannot read');
select ok(not public.member_can_view_workspace_area('00000000-0000-4000-8000-000000000199','ryd'),
  'missing profile cannot read');

-- Simulate losing only the RY-D metadata while the read RPC is still present.
set local role postgres;
delete from public.workspace_area_access where area='ryd';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true);
select ok(not public.can_view_workspace_area('ryd'),'missing metadata denies the RY-D team');
select ok(not ('ryd'=any(public.accessible_workspace_areas(array['notes','contacts','calendar','ryd']))),
  'navigation excludes RY-D when its metadata is missing');
select ok(public.can_view_workspace_area('ryd-test-unconfigured'),
  'other unconfigured pages retain their open default');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select ok(not public.can_view_workspace_area('ryd'),'missing metadata denies a workspace-wide tier');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
select ok(not public.can_view_workspace_area('ryd'),'missing metadata denies an inherited tier');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000105',true);
select ok(not public.can_view_workspace_area('ryd'),'missing metadata denies ordinary members');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select ok(public.can_view_workspace_area('ryd'),'owners retain their metadata override');
select set_config('request.jwt.claim.sub','',true);
select ok(not public.can_view_workspace_area('ryd'),'signed-out identity is denied without metadata');

set local role service_role;
select results_eq(
  $$select id from public.workspace_area_members('ryd') id where id::text like '00000000-0000-4000-8000-00000000010%' order by id$$,
  $$values ('00000000-0000-4000-8000-000000000101'::uuid)$$,
  'missing metadata reduces recipients to onboarded app owners');
select throws_ok($$select public.ryd_require_operator('00000000-0000-4000-8000-000000000104')$$,
  '42501','RY-D access is required.','writes deny the same team member as reads');
select lives_ok($$select public.ryd_require_operator('00000000-0000-4000-8000-000000000101')$$,
  'owner writes retain the same override as reads');

set local role postgres;
insert into public.workspace_area_access(area,access_mode) values('ryd','open');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000105',true);
select ok(public.can_view_workspace_area('ryd'),'an explicitly open RY-D page allows ordinary members');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000106',true);
select ok(not public.can_view_workspace_area('ryd'),'an explicitly open page still requires onboarding');
set local role service_role;
select is((select count(*) from public.workspace_area_members('ryd') id
  where id::text like '00000000-0000-4000-8000-00000000010%'),5::bigint,
  'explicitly open recipients include every onboarded fixture member');

set local role postgres;
update public.workspace_area_access set access_mode='restricted' where area='ryd';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true);
select ok(not public.can_view_workspace_area('ryd'),'restricted mode with no grants closes team reads');
set local role service_role;
select is((select count(*) from public.workspace_area_members('ryd') id
  where id::text like '00000000-0000-4000-8000-00000000010%'),1::bigint,
  'restricted mode with no grants leaves only owner recipients');

set local role postgres;
set local session_replication_role=replica;
update public.profiles set onboarding_completed=false where id='00000000-0000-4000-8000-000000000101';
set local session_replication_role=origin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select ok(not public.can_view_workspace_area('ryd'),'even an owner must complete onboarding');
set local role service_role;
select is((select count(*) from public.workspace_area_members('ryd') id
  where id::text like '00000000-0000-4000-8000-00000000010%'),0::bigint,
  'an incomplete owner is not a recipient');
select throws_ok($$select public.ryd_require_operator('00000000-0000-4000-8000-000000000101')$$,
  '42501','RY-D access is required.','an incomplete owner cannot write');

select * from finish();
rollback;
