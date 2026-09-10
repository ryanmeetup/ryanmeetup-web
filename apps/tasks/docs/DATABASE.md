# Database, migrations, and the schema baseline

How the Tasks database is described in this repository, how to change it safely,
and how to prove a change is correct before it reaches production.

If you are standing up a second instance, read this first and then
`docs/MULTI_INSTANCE.md`, which covers everything outside the database.

## The short version

- Every schema change is a migration file in `supabase/migrations`. **Never let
  a dashboard edit be the only record of a change, and never delete an applied
  migration file.** RMT receives the file with `supabase db push`; PRD is not
  reachable from this machine and receives the same SQL through its dashboard
  SQL Editor.
- `20260731000000_baseline_schema.sql` reproduces the entire database from
  nothing. `supabase/seed.sql` adds the rows a workspace needs to be usable.
- Verify any change with `supabase db reset` followed by
  `supabase db diff --linked`. For this schema that is not a formality — see
  "What verification caught".

## Why the baseline exists

Production's `supabase_migrations.schema_migrations` table records **67 applied
migrations**, from `20260801000000` to `20260904030000`. Not one of their files
was in this repository.

Migrations had always been the practice. The files were being discarded after
they were applied — the same thing that happened to
`20260822000000_instance_settings.sql`, which created a table that exists in
production and whose file no longer exists anywhere.

The consequence was that a second database could not be built from source, and
the first one had no disaster recovery. The baseline is that lost history,
flattened into a single starting point. Everything after it is an ordinary
forward migration.

The 67 orphaned history rows are harmless and can stay. What matters is that
every migration from here forward exists as a committed file.

## What the baseline contains

`supabase/migrations/20260731000000_baseline_schema.sql`, roughly 4,200 lines,
in dependency order:

| Part                        | Why it needs to be there                                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public schema               | 34 tables, 54 functions, 74 policies, 30 triggers, 5 enums, 27 indexes. RLS is enabled on all 34 tables and 38 functions are `security definer`                                                                                                                       |
| `auth_user_profile` trigger | Fires `public.handle_new_user()` on insert into `auth.users`. **A public-schema dump does not include it.** `app/api/team/route.ts` calls `inviteUserByEmail` and never inserts a profile itself, so without this trigger every invited user silently gets no profile |
| Storage buckets             | Six `insert into storage.buckets` rows. Buckets are _data_, so no schema dump carries them                                                                                                                                                                            |
| Storage policies            | 15 policies on `storage.objects`. They call public-schema functions such as `can_view_task`, which is why they come last                                                                                                                                              |
| Grant corrections           | Explicit revokes on three privileged tables — see "What verification caught"                                                                                                                                                                                          |

The authorization model lives almost entirely in SQL: `is_app_owner`,
`can_view_task`, `can_edit_project`, `can_access_category`,
`project_permission_for`, `member_has_group_access` and their siblings, plus the
transactional writers `save_task`, `move_task`, `create_status`,
`reorder_statuses`, `save_contact`, `set_category_access`, and
`set_workspace_area_access`. A policy missed during a hand rebuild is a silent
data leak rather than a visible error, which is why the baseline is generated
rather than written.

`20260924000000_workspace_area_access.sql` adds the last of those: two tables
(`workspace_area_access`, `workspace_area_group_grants`) and
`can_view_workspace_area`, which the Notes, Contacts, and Calendar policies now
sit behind. Both tables are owner-only; members reach the answer through
`accessible_workspace_areas`, a `security definer` function that reports on the
caller alone. The set of lockable pages lives in
`lib/access/workspace-areas.ts`, so adding one is a registry entry plus a
policy, not a new column.

### Storage buckets

| Bucket                 | Public | Size limit | MIME types                       |
| ---------------------- | ------ | ---------- | -------------------------------- |
| `profile-avatars`      | yes    | 5 MB       | jpeg, png, webp                  |
| `instance-assets`      | yes    | 2 MB       | png, jpeg, svg+xml, webp         |
| `organization-images`  | yes    | 5 MB       | jpeg, png, webp                  |
| `task-attachments`     | no     | 10 MB      | pdf, jpeg, png, webp, text/plain |
| `project-attachments`  | no     | 10 MB      | pdf, jpeg, png, webp, text/plain |
| `category-attachments` | no     | 10 MB      | pdf, jpeg, png, webp, text/plain |

`public` set wrong on any of the three attachment buckets would expose every
uploaded file.

Contact uploads are stored by their server-owned `contacts.image_path`; the
public URL is derived only when contacts are read. Replacing, removing, or
deleting a contact image retires the previous object after the database write
succeeds. External image URLs remain supported in `contacts.image_url` and are
never treated as storage objects owned by the app.

Contact people keep labeled, repeatable addresses in `email_methods` and
`phone_methods`. The older `emails` and `phone` columns remain as a
compatibility projection so an older app deployment can continue saving during
a rolling migration; `save_contact_with_methods` writes both representations in
one transaction.

### The seed

`supabase/seed.sql` inserts the six default statuses. `handle_new_user` installs
the same rows when the first account is created on a hosted project where the
seed was not run, and the server repairs an older empty instance on its next
authenticated workspace load. A workspace without at least one status is
unusable: the board has no columns and no task can be created.

| Name        | Color     | Order | Outcome     |
| ----------- | --------- | ----- | ----------- |
| Backlog     | `#64748b` | 0     | open        |
| Todo        | `#2563eb` | 1     | open        |
| In Progress | `#d97706` | 2     | open        |
| In Review   | `#7c3aed` | 3     | open        |
| Done        | `#059669` | 4     | `delivered` |
| Will Not Do | `#f51b2b` | 5     | `declined`  |

`statuses.outcome` is what ends a task. Both `delivered` and `declined` stamp
`completed_at`, archive the task fourteen days later, and take it out of every
open count; only `delivered` counts toward what a project completed. The older
`is_completed` column remains as a generated projection of
`outcome = 'delivered'` so a deployment from before that change keeps reading a
sensible answer during a rollout. Nothing writes it.

It is guarded with `where not exists (select 1 from public.statuses)` rather
than `on conflict`. The unique constraint on `statuses` is deferrable, and
Postgres rejects a deferrable constraint as an `on conflict` arbiter with
`SQLSTATE 55000`. The guard also makes the seed safe to re-run.

`supabase db reset` runs the seed automatically. That is a **local** command;
never point it at a hosted project. The first signup bootstraps a hosted
project automatically, though the idempotent seed can still be applied with
`psql "$DB_URL" -f supabase/seed.sql` or through the SQL editor when validating
a new installation before signup.

### Why the default access tier is not in the seed

A workspace also needs one organizational tier. `handle_new_user` puts each
signup in the lowest-ranked `tier` group, and
`grant_new_project_to_creator_groups` raises `23514` for a project whose creator
holds no group — which the API flattens into "Some of the submitted information
is no longer valid," so the cause is only visible in the server log.

That row cannot live in the seed: `access_groups.created_by` is `not null` and
references `profiles`, and the seed runs before any user exists.
`handle_new_user` creates the tier itself when none is there yet, so the first
signup on a new instance bootstraps it. The function lives in the baseline, and
any later change to it ships as its own committed migration like anything else.

The linked schema marks this tier explicitly with `access_groups.is_default`.
`provision_workspace_member` creates or repairs the profile, starter statuses,
and membership in that default tier as one idempotent operation. Higher tiers
inherit the default tier's grants, so the baseline behaves as the general
members group without duplicating every person into a second team.

`beginner_flow_health()` checks that contract, the signup trigger, profiles,
memberships, and starter statuses. The Admin integrations page exposes those
checks and calls `repair_beginner_flow()` when an owner requests a repair. A
production build also runs `scripts/check-database-contract.mjs`, preventing a
deployment when the configured database is reachable but missing the required
contract.

In Vercel, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` must all come
from the same linked project. Trigger a fresh deployment after rotating them;
redeploying an older deployment can reuse its previous environment snapshot.

## How the baseline was captured

With `supabase db dump`, which is read-only `pg_dump` — **not**
`supabase db pull`.

`db pull` reconciles the remote migration history, and with 67 orphaned rows it
would have tried to rewrite that history on production. Nothing in this process
writes to the production database.

```sh
supabase db dump --linked                  -f public.sql   # 34 tables, 54 functions
supabase db dump --linked --schema auth    -f auth.sql     # the profiles trigger
supabase db dump --linked --schema storage -f storage.sql  # 15 object policies
```

The bucket rows were read from the storage API, since a schema dump does not
include data.

**Only app-owned objects were taken from the auth and storage dumps.** Those
dumps also contain 23 `auth` tables and 8 `storage` tables that Supabase
provisions itself; re-creating them breaks a new project. From `auth` the
baseline keeps exactly one trigger, and from `storage` exactly the 15 policies.

## How to verify a schema change

```sh
supabase db reset                          # baseline + later migrations + seed, from empty
supabase db diff --linked --schema public  # compare the result against production
npm test                                   # unit and route tests
```

`db diff` should report only migrations production has not received yet, plus
occasional cosmetic policy role reordering (migra normalises `TO
"authenticated", "anon"` to `to anon, authenticated`). Anything else is real
drift.

**The e2e suite does not verify the database.** It runs against
`tests/e2e/mock-supabase.mjs`, a small stub server, so it is hermetic and passes
regardless of what any real database contains. That is deliberate — it keeps
e2e from depending on a running Supabase stack — but it means a green
`npm run test:e2e` says nothing about a schema change. `db diff` is the check
that matters.

To exercise the app against a database built from this repository, point a dev
server at the local stack after `supabase db reset` and use it by hand:

```sh
supabase status   # read API_URL and PUBLISHABLE_KEY for the local stack
```

### What verification caught

Applying the baseline to an empty database and diffing it back against
production found a fault that reading the file would never have shown.

**Supabase's default privileges grant `anon` and `authenticated` on every newly
created table in schema `public`, and a dump's explicit
`GRANT ... TO service_role` does not take them away.** A database built from the
baseline was therefore _more permissive than the one it was captured from_, on
`privileged_audit_events`, `privileged_rate_limits`, and
`workspace_google_calendar_integrations`.

The fix is the explicit revoke block at the end of the baseline. The lesson is
that this class of difference is invisible in the SQL and only appears in a
round-trip diff, so **verification is not optional for schema files**.

### A comparison trap worth avoiding

PostgREST only advertises what the calling role may execute. Introspecting
production with the **secret** key and a local database with the **publishable**
key appears to show nine missing functions:

```
consume_privileged_rate_limit, create_status, create_subtask_with_activity,
delete_status, list_orphaned_task_attachment_paths,
record_privileged_audit_event, reorder_statuses, save_task, set_category_access
```

Nothing is missing. Those are privileged functions granted only to
`service_role` and called through the admin client. Always compare like with
like.

## Working on the schema

1. Write a new migration in `supabase/migrations` with a timestamp after the
   latest one.
2. `supabase db reset` to apply it from empty, then `supabase db diff --linked`
   to see exactly what it changes relative to production.
3. Run `npm test`. (`npm run test:e2e` is hermetic and will not exercise it.)
4. Commit the file. This is the step that was being skipped.
5. Apply it to both projects. RMT is reachable from this machine, so run
   `supabase db push` yourself. PRD is not, so hand Ryan the migration's SQL as
   one complete, paste-ready block for its dashboard SQL Editor, with a
   verification query and the result to expect.

Code that reads a table added by a migration that may not be applied yet can
tolerate a missing relation through `isMissingRelation` in
`lib/server/supabase-errors.ts` and fall back to defaults, so the deploy and the
migration can land in either order. `instance_settings` and `digest_settings`
both do this. That tolerance is only ever for a missing table — every other
database failure must propagate rather than be swallowed.

### Messages a migration writes for the person reading them

A function that validates its input before it writes raises `RS001`, not
`23514`. `23514` is the SQLSTATE Postgres uses for a check constraint, so the
API cannot tell a sentence a migration authored apart from `new row for
relation "projects" violates check constraint ...`, and answers both with "Some
of the submitted information is no longer valid." `RS001` is what makes the
message returnable: `isRejectedResourceValue` in
`lib/server/supabase-errors.ts` sends it back verbatim, the way
`isMissingStatusReason` returns `TK001` from `save_task`. `23514` keeps the
generic wording, because its text describes the table rather than the person.

Only raise it for something the person can change -- an owner who has not
finished onboarding, access groups on a project that is not restricted -- and
write the message as the sentence you want them to read. A raise about a
workspace that is set up wrong, like
`grant_new_project_to_creator_groups` above, is not one of these.

## Outstanding

- **PRD is six migrations behind, and one of them is not at the end.** Read
  from PRD's own history on 2026-09-10: it holds everything through
  `20260928000000`, then `20261003000000`, and is missing `20260929000000`,
  `20260930000000`, `20261001000000`, `20261002000000`, `20261004000000`, and
  `20261005000000`.

  This entry said eleven behind, then twenty, then four, and each was wrong by
  the time it was read. Run the query below before believing this bullet, and
  read the whole list rather than the five most recent — a gap in the middle is
  what PRD actually had, and the latest version alone hides it.

  PRD does not get CLI commands: hand over the SQL as one paste-ready block
  for its dashboard SQL Editor, with a verification query, stated explicitly
  as running on PRD. `scripts/build-catchup-sql.mjs` writes that block — every
  migration the instance lacks, in one transaction, guarded so it refuses a
  database it does not fit, ending with the rows that record it. **Pass it the
  history query's own output**, quoted, rather than a single version: a single
  version means "everything up to here is applied", which was true of PRD
  until it applied `20261003000000` on its own, and a block built that way
  would have carried a migration it already had. Verify the block before
  handing it over, the same way the one on 2026-09-06 was, and reproduce the
  instance's real history rather than a tidy prefix of it when it has a gap:

  ```sh
  supabase db reset --local --no-seed                        # every migration
  pg_dump --schema-only --schema=public --schema=storage     # keep this dump
  supabase db reset --local --no-seed --version <its last ungapped version>
  psql -f <each migration it has beyond that>                # rebuild its gap
  psql -v ON_ERROR_STOP=1 -f catchup.sql                     # the block itself
  pg_dump --schema-only --schema=public --schema=storage     # must match
  ```

  The 2026-09-10 block was verified that way, against a local database rebuilt
  to PRD's real history, `20261003000000` applied before its four predecessors
  and all. The resulting schema matched a clean run of every migration exactly,
  so applying those four after it is safe.

  Never `--linked`: that resets RMT.

- **Ask PRD what it has rather than trusting this section.** Nothing in the
  repository records what PRD holds, and a note here is only true until the
  next migration lands. Run this in the PRD SQL Editor and compare against
  `supabase/migrations`:

  ```sql
  select string_agg(version, ', ' order by version)
  from supabase_migrations.schema_migrations;
  ```

  A handover block should end by inserting its versions into that table, or
  the next reading of it is wrong again.

- **Every migration must reach both projects.** A schema change applied to one
  and not the other is the beginning of exactly the drift this document was
  written to end.

## The provisioning-contract drift

`20260907000000_workspace_provisioning_contract.sql` is the second time the
same failure produced the same result, and it is worth naming.

`provision_workspace_member`, `beginner_flow_health`, `repair_beginner_flow`,
`set_project_visibility`, `create_project_with_visibility`,
`protect_default_access_tier`,
`normalize_project_visibility_after_group_delete`, `projects.access_mode`, and
`access_groups.is_default` were applied straight to the Ryan Meetup project
while the visibility and onboarding work landed. No migration file was
committed for any of them, and this document said so in passing rather than
treating it as a defect.

Nothing was visibly wrong, because the only database that existed already had
them. The cost only appeared when a second instance was built from this
repository: `projects.ryanle.dev` came up on its own project without the
contract, and `scripts/check-database-contract.mjs` refused the deploy with a
404 on `beginner_flow_health`. The last deployment that had succeeded was built
against the _first_ instance's credentials, so the second instance served the
first instance's data while looking healthy.

The recovery was mechanical, and is the recipe for any future divergence:

```sh
supabase db reset                                   # local, from the repo
supabase db diff --linked --schema public -f drift  # exactly what production has that the repo does not
supabase db reset                                   # verify the captured file applies from empty
supabase db diff --linked --schema public           # must report no schema changes
```

The preflight is what turned a silent wrong-data condition into a failed build.
Do not reach for `SKIP_DATABASE_CONTRACT_CHECK=1` to get a deploy through; it
exists for a database that is deliberately unreachable at build time, not for
one that is missing the contract.
