-- Default statuses, matching the Ryan Meetup workspace.
--
-- A workspace is unusable without at least one status: the board has no
-- columns and no task can be created. `handle_new_user` also installs these
-- rows for hosted projects where the optional seed step was skipped.

insert into public.statuses (name, description, color, sort_order, is_default, outcome, requires_reason)
select * from (values
  ('Backlog', 'Ideas and requests that are not ready to schedule yet.', '#64748b', 0, true, 'open', false),
  ('Todo', 'Ready to be picked up and worked on.', '#2563eb', 1, true, 'open', false),
  ('In Progress', 'Actively being worked on right now.', '#d97706', 2, true, 'open', false),
  ('In Review', 'Waiting for feedback, approval, or final checks.', '#7c3aed', 3, true, 'open', false),
  ('Done', 'Finished work that no longer needs action.', '#059669', 4, true, 'delivered', false),
  ('Will Not Do', 'Work that has been intentionally declined and will not be pursued.', '#f51b2b', 5, true, 'declined', true)
) as seed (name, description, color, sort_order, is_default, outcome, requires_reason)
-- Only seed an empty workspace. `on conflict` cannot be used here: the unique
-- constraint on statuses is deferrable, which Postgres rejects as an arbiter.
where not exists (select 1 from public.statuses);

-- The default organizational tier is deliberately not seeded here. A workspace
-- needs one — `grant_new_project_to_creator_groups` rejects a project whose
-- creator holds no group — but `access_groups.created_by` is `not null` and
-- references `profiles`, and `supabase db reset` runs this file before any user
-- exists, so there is no one to attribute it to. `handle_new_user` creates the
-- tier instead, when the first user signs up and no tier is there yet.
