-- Every table in `public` states its own grants.
--
-- Supabase stops granting the Data API roles on new `public` tables for
-- existing projects on 2026-10-30. The baseline still carries the old
-- `alter default privileges ... on tables to anon, authenticated, service_role`
-- it was dumped with, so a database built from empty would go on granting
-- everything while RMT and PRD grant nothing: a migration that forgot its grants
-- would pass `supabase db reset` and fail with `permission denied` in
-- production. Dropping the defaults here makes every database behave the same
-- way now, ahead of the cutover, and `supabase/tests/access_control.sql` fails
-- on any table that comes up without grants.
--
-- Write the grants in the migration that creates the table, scoped to who
-- reaches it: `authenticated` for what the user client reads or writes under
-- RLS, `service_role` for the admin client, `anon` only for something an
-- unauthenticated visitor genuinely reads.
--
-- Sequences and functions keep their defaults; the change covers tables only.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

-- The only tables created after the baseline without grants of their own. They
-- received everything, `anon` included, through the defaults above. Owners read
-- both through the user client under RLS, and every write goes through the
-- service role, so the grants now say exactly that.
revoke all on table public.digest_settings, public.digest_runs
  from anon, authenticated;

grant select on table public.digest_settings, public.digest_runs
  to authenticated;
grant select, insert, update, delete
  on table public.digest_settings, public.digest_runs
  to service_role;
