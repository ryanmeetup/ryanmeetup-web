-- A status now says how work ended, not merely whether it is finished.
--
-- `is_completed` was answering two questions with one boolean: does this task
-- still need attention, and did the team actually deliver it. "Will Not Do"
-- had to pick a side, and it picked wrong. Declined work kept its
-- `completed_at` empty, so it never archived, never left the open counts, kept
-- arriving in the weekday digest, held its place on the calendar, and stayed
-- overdue on a project's attention list forever. Marking it complete instead
-- would have closed all of that and reported abandoned work as delivered.
--
-- `outcome` separates the two. Both `delivered` and `declined` close a task and
-- send it to the archive on the usual fourteen-day delay; only `delivered`
-- counts toward what a project has completed.
--
-- `is_completed` stays behind as a generated column so a deployment that has
-- not shipped this change yet keeps reading the same answer it reads today: a
-- decline looks open to it, which is exactly its current behavior. Nothing
-- writes it any more. Drop it once both instances are past this release.

alter table public.statuses
  add column if not exists outcome text not null default 'open';

alter table public.statuses
  drop constraint if exists statuses_outcome_check;

alter table public.statuses
  add constraint statuses_outcome_check
  check (outcome in ('open', 'delivered', 'declined'));

update public.statuses
set outcome = 'delivered'
where is_completed
  and outcome = 'open';

-- The declined default, by name: an instance that renamed it has already
-- decided what that status means and should set the outcome itself.
update public.statuses
set outcome = 'declined'
where name = 'Will Not Do'
  and outcome = 'open';

-- A task's completion dates follow the outcome of the status it sits in.
create or replace function public.set_task_completion_lifecycle() returns trigger
    language plpgsql
    set search_path to ''
    as $$
declare
  status_outcome text;
begin
  select outcome
  into status_outcome
  from public.statuses
  where id = new.status_id;

  if status_outcome is distinct from 'open' then
    if new.completed_at is null then
      new.completed_at = now();
    end if;
    if new.archived_at is null then
      new.archived_at = new.completed_at + interval '14 days';
    end if;
  else
    new.completed_at = null;
    new.archived_at = null;
  end if;

  return new;
end;
$$;

-- Changing what a status means re-dates every task sitting in it. The trigger
-- has to be dropped before its column can be, and comes back watching
-- `outcome`.
drop trigger if exists statuses_refresh_task_completion on public.statuses;

create or replace function public.refresh_tasks_for_status_completion() returns trigger
    language plpgsql
    set search_path to ''
    as $$
begin
  if old.outcome is distinct from new.outcome then
    update public.tasks
    set status_id = status_id
    where status_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.statuses drop column if exists is_completed;

alter table public.statuses
  add column is_completed boolean
  generated always as (outcome = 'delivered') stored;

create trigger statuses_refresh_task_completion
  after update of outcome on public.statuses
  for each row execute function public.refresh_tasks_for_status_completion();

-- Tasks already sitting in a declined status have no completion dates, and the
-- trigger above only fires on a write. Date them from the activity row that
-- records the move that put them there, so the archive shows when the decision
-- was actually made rather than when this migration ran. A task declined more
-- than fourteen days ago is therefore already archived, which is the point.
update public.tasks as task
set
  completed_at = decided.at,
  archived_at = decided.at + interval '14 days'
from (
  select
    task.id,
    coalesce(
      (
        select max(activity.created_at)
        from public.task_activity as activity
        where activity.task_id = task.id
          and activity.action = 'moved task'
          and activity.details ->> 'status_id' = task.status_id::text
      ),
      task.updated_at
    ) as at
  from public.tasks as task
  join public.statuses as status on status.id = task.status_id
  where status.outcome is distinct from 'open'
    and task.completed_at is null
) as decided
where task.id = decided.id;

-- The bootstrap workflow ships the same contract as `supabase/seed.sql` and
-- `lib/workspace/default-statuses.ts`.
create or replace function public.provision_workspace_member(
  requested_profile_id uuid,
  requested_full_name text default null::text,
  requested_email text default null::text
)
returns public.profiles
language plpgsql
security definer
set search_path to ''
as $function$
declare
  default_tier_id uuid;
  saved_profile public.profiles;
begin
  if requested_profile_id is null then
    raise exception 'A profile id is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public.workspace_member.provision', 0)
  );

  insert into public.profiles (id, full_name)
  values (
    requested_profile_id,
    coalesce(
      nullif(trim(requested_full_name), ''),
      nullif(split_part(coalesce(requested_email, ''), '@', 1), ''),
      'New teammate'
    )
  )
  on conflict (id) do nothing;

  insert into public.statuses (
    name,
    description,
    color,
    sort_order,
    is_default,
    outcome,
    requires_reason
  )
  select * from (values
    ('Backlog', 'Ideas and requests that are not ready to schedule yet.', '#64748b', 0, true, 'open', false),
    ('Todo', 'Ready to be picked up and worked on.', '#2563eb', 1, true, 'open', false),
    ('In Progress', 'Actively being worked on right now.', '#d97706', 2, true, 'open', false),
    ('In Review', 'Waiting for feedback, approval, or final checks.', '#7c3aed', 3, true, 'open', false),
    ('Done', 'Finished work that no longer needs action.', '#059669', 4, true, 'delivered', false),
    ('Will Not Do', 'Work that has been intentionally declined and will not be pursued.', '#f51b2b', 5, true, 'declined', true)
  ) as defaults (name, description, color, sort_order, is_default, outcome, requires_reason)
  where not exists (select 1 from public.statuses);

  select id into default_tier_id
  from public.access_groups
  where is_default and kind = 'tier'
  limit 1;

  if default_tier_id is null then
    select id into default_tier_id
    from public.access_groups
    where kind = 'tier'
    order by hierarchy_rank, created_at, id
    limit 1;

    if default_tier_id is null then
      insert into public.access_groups (
        name,
        description,
        created_by,
        kind,
        hierarchy_rank,
        is_default
      ) values (
        'Members',
        'The baseline tier inherited by everyone in the workspace.',
        requested_profile_id,
        'tier',
        0,
        true
      )
      returning id into default_tier_id;
    else
      update public.access_groups
      set is_default = true
      where id = default_tier_id;
    end if;
  end if;

  if not exists (
    select 1
    from public.access_group_members membership
    join public.access_groups access_group
      on access_group.id = membership.group_id
    where membership.profile_id = requested_profile_id
      and access_group.kind = 'tier'
  ) then
    insert into public.access_group_members (group_id, profile_id, added_by)
    values (default_tier_id, requested_profile_id, requested_profile_id)
    on conflict do nothing;
  end if;

  select * into saved_profile
  from public.profiles
  where id = requested_profile_id;

  return saved_profile;
end;
$function$;
