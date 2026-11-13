begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000301', 'saved-view-owner@example.test', '{}'),
 ('00000000-0000-4000-8000-000000000302', 'saved-view-member@example.test', '{}');
set local session_replication_role = replica;
update public.profiles set onboarding_completed = true, app_role = 'member'
 where id in ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000302');
update public.profiles set app_role = 'owner' where id = '00000000-0000-4000-8000-000000000301';
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
select lives_ok($$insert into public.saved_task_views (id, profile_id, name, settings) values
 ('00000000-0000-4000-8000-000000000303', auth.uid(), 'Focus', '{"version":1,"filters":{}}')$$, 'member can create a personal view');
select is((select count(*)::int from public.saved_task_views), 1, 'member can read their own view');
select throws_ok($$insert into public.saved_task_views (profile_id, name, settings) values
 ('00000000-0000-4000-8000-000000000301', 'Forged', '{"version":1,"filters":{}}')$$, '42501', null, 'member cannot create another person''s view');
select throws_ok($$insert into public.saved_task_views (profile_id, name, settings) values
 (auth.uid(), 'focus', '{"version":1,"filters":{}}')$$, '23505', null, 'names are unique per person ignoring case');
select throws_ok($$update public.saved_task_views set profile_id = '00000000-0000-4000-8000-000000000301'$$, '42501', null, 'member cannot transfer ownership');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000301', true);
select is((select count(*)::int from public.saved_task_views), 0, 'even an app owner cannot read another person''s views');
with changed as (update public.saved_task_views set name = 'Changed' returning id) select is((select count(*)::int from changed), 0, 'owner cannot rename another person''s view');
with deleted as (delete from public.saved_task_views returning id) select is((select count(*)::int from deleted), 0, 'owner cannot delete another person''s view');
select lives_ok($$insert into public.saved_task_views (profile_id, name, settings) values
 (auth.uid(), 'Focus', '{"version":1,"filters":{}}')$$, 'different people can use the same name');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
select lives_ok($$update public.saved_task_views set name = 'Life improvements' where profile_id = auth.uid()$$, 'member can rename their view');
select lives_ok($$delete from public.saved_task_views where profile_id = auth.uid()$$, 'member can delete their view');

reset role;
select ok(not has_table_privilege('anon', 'public.saved_task_views', 'SELECT'), 'anonymous reads have no grant');
select * from finish();
rollback;
