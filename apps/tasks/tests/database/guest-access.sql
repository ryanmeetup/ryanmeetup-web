begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000201', 'guest-owner@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000202', 'guest-member@example.test', '{}'),
  ('00000000-0000-4000-8000-000000000203', 'guest-partner@example.test', '{}');

set local session_replication_role = replica;
update public.profiles set app_role = 'member', onboarding_completed = true
where id::text like '00000000-0000-4000-8000-00000000020%';
update public.profiles set app_role = 'owner'
where id = '00000000-0000-4000-8000-000000000201';
set local session_replication_role = origin;

-- A guest tier ranked above the member tier, so plain rank comparison would
-- otherwise inherit the member tier's grants.
insert into public.access_groups
  (id, name, kind, hierarchy_rank, grants_global_content, guest, created_by) values
  ('20000000-0000-4000-8000-000000000201', 'Guest test members', 'tier', 2147483200, false, false,
   '00000000-0000-4000-8000-000000000201'),
  ('20000000-0000-4000-8000-000000000202', 'Guest test partners', 'tier', 2147483201, false, true,
   '00000000-0000-4000-8000-000000000201'),
  ('20000000-0000-4000-8000-000000000203', 'Guest test partner team', 'team', null, false, false,
   '00000000-0000-4000-8000-000000000201');

select throws_ok($$
  insert into public.access_groups (name, kind, hierarchy_rank, grants_global_content, guest, created_by)
  values ('Global guest', 'tier', 2147483202, true, true, '00000000-0000-4000-8000-000000000201')
$$, '23514', null, 'a guest tier cannot carry workspace-wide content access');
select throws_ok($$
  insert into public.access_groups (name, kind, guest, created_by)
  values ('Guest team', 'team', true, '00000000-0000-4000-8000-000000000201')
$$, '23514', null, 'only tiers can be guest tiers');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000201', true);
select public.set_profile_access_tier('00000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000201');
select public.set_profile_access_tier('00000000-0000-4000-8000-000000000203', '20000000-0000-4000-8000-000000000202');
set local role postgres;
insert into public.access_group_members (group_id, profile_id, added_by) values
  ('20000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000201');

insert into public.projects (id, name, created_by, access_mode) values
  ('30000000-0000-4000-8000-000000000201', 'Guest test open project', '00000000-0000-4000-8000-000000000201', 'open'),
  ('30000000-0000-4000-8000-000000000202', 'Guest test member project', '00000000-0000-4000-8000-000000000201', 'restricted'),
  ('30000000-0000-4000-8000-000000000203', 'Guest test partner project', '00000000-0000-4000-8000-000000000201', 'restricted');
insert into public.project_group_grants (project_id, group_id, permission, granted_by) values
  ('30000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000201', 'editor', '00000000-0000-4000-8000-000000000201'),
  ('30000000-0000-4000-8000-000000000203', '20000000-0000-4000-8000-000000000203', 'editor', '00000000-0000-4000-8000-000000000201');
insert into public.work_groups (id, name, color, created_by, access_mode) values
  ('40000000-0000-4000-8000-000000000201', 'Guest test open category', '#2563eb', '00000000-0000-4000-8000-000000000201', 'open');
insert into public.tasks (id, title, status_id, created_by, reported_by, board_position) values
  ('50000000-0000-4000-8000-000000000201', 'Guest test projectless task',
   (select id from public.statuses order by sort_order limit 1),
   '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000201', 1);

-- RY-D restricted to the partner team; Notes left unconfigured; Contacts open.
delete from public.workspace_area_access where area in ('ryd', 'notes', 'contacts');
insert into public.workspace_area_access (area, access_mode) values
  ('ryd', 'restricted'), ('contacts', 'open');
insert into public.workspace_area_group_grants (area, group_id) values
  ('ryd', '20000000-0000-4000-8000-000000000203');

set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000202', true);
select ok(not public.is_guest(), 'an ordinary member is not a guest');
select ok(public.can_view_project('30000000-0000-4000-8000-000000000201'), 'members reach open projects');
select ok(public.can_view_project('30000000-0000-4000-8000-000000000202'), 'members reach their tier''s projects');
select ok(public.can_access_category('40000000-0000-4000-8000-000000000201'), 'members reach open categories');
select ok(public.can_view_task('50000000-0000-4000-8000-000000000201'), 'members reach projectless tasks');
select ok(public.can_view_workspace_area('notes'), 'members reach unconfigured pages');
select ok(public.can_view_workspace_area('contacts'), 'members reach open pages');
select ok(not public.can_view_workspace_area('ryd'), 'members do not reach the partner page');
select ok((select count(*) from public.profiles where id::text like '00000000-0000-4000-8000-00000000020%') = 3,
  'members read the member directory');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000203', true);
select ok(public.is_guest(), 'a guest-tier member is a guest');
select ok(not public.can_view_project('30000000-0000-4000-8000-000000000201'), 'guests skip open projects');
select ok(not public.can_view_project('30000000-0000-4000-8000-000000000202'),
  'guests do not inherit a lower tier''s project grants');
select ok(public.can_view_project('30000000-0000-4000-8000-000000000203'), 'guests reach projects granted to their team');
select ok(not public.can_access_category('40000000-0000-4000-8000-000000000201'), 'guests skip open categories');
select ok(not public.can_view_task('50000000-0000-4000-8000-000000000201'), 'guests skip projectless tasks');
select is((select count(*) from public.tasks where id = '50000000-0000-4000-8000-000000000201'), 0::bigint,
  'RLS hides projectless tasks from guests');
select throws_ok($$
  insert into public.tasks (title, status_id, created_by, reported_by, board_position)
  values ('Guest task', (select id from public.statuses order by sort_order limit 1),
    '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000203', 2)
$$, '42501', null, 'guests cannot create projectless tasks');
select ok(not public.can_view_workspace_area('notes'), 'guests skip unconfigured pages');
select ok(not public.can_view_workspace_area('contacts'), 'guests skip open pages');
select ok(public.can_view_workspace_area('ryd'), 'guests reach a page granted to their team');
select is((select count(*) from public.profiles where id::text like '00000000-0000-4000-8000-00000000020%'), 1::bigint,
  'guests read only their own profile');
select throws_ok($$select public.member_is_guest('00000000-0000-4000-8000-000000000202')$$,
  '42501', null, 'members cannot ask whether someone else is a guest');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000202', true);
select ok(not public.can_assign_to_project('00000000-0000-4000-8000-000000000203', '30000000-0000-4000-8000-000000000201'),
  'guests cannot be assigned work in open projects');
select ok(not public.can_assign_to_project('00000000-0000-4000-8000-000000000203', null),
  'guests cannot be assigned projectless work');
select ok(public.can_assign_to_project('00000000-0000-4000-8000-000000000203', '30000000-0000-4000-8000-000000000203'),
  'guests can be assigned work in projects granted to them');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000201', true);
select throws_ok($$select public.set_default_access_tier('20000000-0000-4000-8000-000000000202')$$,
  '23514', 'A guest tier cannot be the default for new members', 'a guest tier cannot be the default');

-- RY-D Settings is a fixed rule: app owners and workspace-wide tiers only.
select throws_ok($$select public.set_workspace_area_access('ryd-settings', 'restricted',
    array['20000000-0000-4000-8000-000000000203'::uuid])$$,
  'RS001', null, 'RY-D Settings access cannot be configured');

set local role postgres;
select ok(not public.member_can_view_workspace_area('00000000-0000-4000-8000-000000000202', 'ryd-settings'),
  'a member outside a workspace-wide tier cannot open RY-D Settings');
select ok(public.member_can_view_workspace_area('00000000-0000-4000-8000-000000000201', 'ryd-settings'),
  'app owners keep RY-D Settings');
-- Even a stray grant row written around the RPC opens nothing.
insert into public.workspace_area_access (area, access_mode) values ('ryd-settings', 'restricted');
insert into public.workspace_area_group_grants (area, group_id) values
  ('ryd-settings', '20000000-0000-4000-8000-000000000203');
select ok(not public.member_can_view_workspace_area('00000000-0000-4000-8000-000000000203', 'ryd-settings'),
  'a group grant does not open RY-D Settings');
update public.access_groups set grants_global_content = true
where id = '20000000-0000-4000-8000-000000000201';
select ok(public.member_can_view_workspace_area('00000000-0000-4000-8000-000000000202', 'ryd-settings'),
  'a workspace-wide tier opens RY-D Settings');

set local role postgres;
select ok('00000000-0000-4000-8000-000000000203' in (select public.workspace_area_members('ryd')),
  'page recipients include a guest granted the page');
select ok('00000000-0000-4000-8000-000000000203' not in (select public.workspace_area_members('notes')),
  'page recipients exclude guests from unconfigured pages');

select * from finish();
rollback;
