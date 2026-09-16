# Running Tasks as more than one instance

Tasks was built for Ryan Meetup. The goal recorded here is to run the same
codebase as a second, fully separate workspace — its own database, its own
users, its own domain — without forking and without mixing personal data into
the Ryan Meetup database.

The chosen shape is **one codebase, several single-tenant deployments**. Each
instance is a Vercel project pointing at this repo with its own Supabase project
and its own environment. Both deploy from `main`, so a feature shipped once
lands everywhere.

Two approaches were considered and rejected:

- **A permission flag inside the existing database.** Personal data would live
  in the Ryan Meetup database under its RLS surface, and every table and policy
  would need a tenant discriminator retrofitted onto the working access-group
  model in `lib/access` and the SQL that backs it.
- **A fork.** Every feature would be written twice or merged by hand forever.

## Status

**Done — the application layer is parameterized**, in two tiers. See "What is
already configurable" below.

**Done — an owner-only `/admin` section** at `/admin`, with Overview, Statuses,
Access, Usage, and Settings. `/admin/settings` edits the runtime branding.
Integration health is reported once, on the admin overview, because it is
read-only status rather than something the settings form can change.

**Done — `instance_settings` exists in the Ryan Meetup database.** The migration
that created it was applied and its file removed; nothing about it is
outstanding. Verified by an anonymous read against the live project returning
200, which also confirms its public-select policy is in place.

**Done — the schema is in version control.**
`supabase/migrations/20260731000000_baseline_schema.sql` reproduces the whole
production database, and `supabase/seed.sql` seeds the six default statuses a
workspace needs to be usable. Verified by applying both to an empty database and
diffing the result against production with `supabase db diff --linked`: the only
remaining differences are the digest tables, which production has not received
yet, and cosmetic policy role reordering.

**Still open — 67 orphaned migration history rows.** Production's
`supabase_migrations.schema_migrations` records 67 migrations, from
`20260801000000` to `20260904030000`, and not one of their files is in this
repository. Migrations were always the practice; the files were discarded after
being applied. That is the habit that caused this, and it has to stop — see
"Keeping the baseline honest" below.

**Still open — the digest migration is not applied to production.**
`digest_settings` and `digest_runs` return 404 on the live project.

## Standing up a new instance

A complete, independent instance: its own Supabase project, its own Vercel
project, its own domain, its own users. Nothing is shared with Ryan Meetup
except the code.

Read step 1 before starting. It is most of the work, and steps 3 onward cannot
begin without it.

### What you are reproducing

Everything below is the work outside the database. The database itself — 34
tables, 54 functions, 74 policies, RLS on every table, six storage buckets, and
the trigger that turns an invited user into a profile — is reproduced by the
committed baseline. `docs/DATABASE.md` is the reference for that half.

### 1. The schema baseline (done)

`supabase/migrations/20260731000000_baseline_schema.sql` reproduces the whole
database, and the first signup seeds the six default statuses. The idempotent
`supabase/seed.sql` remains available for local resets and pre-signup
verification, so a new project is built from committed sources rather than by
hand.

**`docs/DATABASE.md` is the reference for all of it** — what the baseline
contains, why it was captured with `db dump` rather than `db pull`, the three
things a schema dump silently omits, and how to verify a change. Read it before
touching the schema.

Two items are still outstanding there and are worth clearing before you create a
second project, because both are about the first one:

- Mark the baseline applied on production:
  `supabase migration repair --status applied 20260731000000`
- Apply the digest migration: `supabase db push`. `digest_settings` and
  `digest_runs` return 404 on the live project today.

### 2. Parameterize `supabase/config.toml`

It hardcodes the Ryan Meetup project:

```toml
project_id = "ryanmeetup-tasks"
site_url = "https://tasks.ryanmeetup.com"
additional_redirect_urls = ["https://tasks.ryanmeetup.com/auth/callback", ...]
```

The Supabase CLI supports `env(VAR)` interpolation, so these can read from the
environment like everything else. Without this, linking the CLI to the second
project fights the checked-in config on every command.

### 3. Create the Supabase project

1. Create a new project in the Supabase dashboard. Pick the region nearest your
   users and record the database password.
2. Link and push:

   ```sh
   supabase link --project-ref <new-project-ref>
   supabase db push        # baseline, then digest_schedule, then any later ones
   ```

3. Optionally apply the idempotent seed before signup with
   `psql "$DB_URL" -f supabase/seed.sql`, or paste it into the SQL editor.
   Otherwise the first signup creates the same six statuses automatically.
   `supabase db reset` runs the seed automatically, but that is a local command
   and must never be pointed at a hosted project.
4. Storage buckets and their policies come with the baseline — nothing to create
   by hand. Confirm all six exist with the public flags in the table above;
   `public` set wrong on `task-attachments` would expose every uploaded file.
5. Configure **Auth → URL Configuration**:
   - Site URL: your new origin, e.g. `https://tasks.example.com`
   - Redirect URLs: `https://tasks.example.com/auth/callback`, plus
     `http://localhost:3000/auth/callback` and `http://127.0.0.1:3000/auth/callback`
     for local development.
6. Decide on signup. Ryan Meetup runs **invite-only** — the live project reports
   `disable_signup: true`, and users arrive through `/admin/access`. Match that
   unless you want open registration.
7. Copy the project URL, publishable key, and secret key from **Settings → API**.

### 4. Bootstrap the first owner

This is the step that has no in-app path, because the app has no "create the
first account" flow — every route requires a session, and `/admin` additionally
requires `is_app_owner()`.

1. In **Authentication → Users**, invite or create your own user. (With signup
   disabled, this is the only way in.)
2. Confirm the trigger created a matching `profiles` row. If it did not, the
   baseline from step 1 missed the trigger — go back and fix it rather than
   inserting a profile by hand, or every future invite will fail the same way.
3. Promote yourself in the SQL editor:

   ```sql
   update public.profiles
      set app_role = 'owner', onboarding_completed = true
    where id = '<your-auth-user-id>';
   ```

   Until `app_role = 'owner'`, `/admin` returns a 404 by design.

4. From then on, add people through `/admin/access` rather than the dashboard,
   so access groups and audit records stay consistent.

### 5. Create the Vercel project

1. **Add New → Project**, import the same Git repository. A repo can back
   several Vercel projects.
2. **Root directory**: `apps/tasks`. Leave build and install commands at the
   Next.js defaults — the monorepo's workspaces resolve from the repo root.
3. **Production branch**: `main`, the same as Ryan Meetup. Both instances then
   receive every feature on merge, which is the entire point of not forking.
4. Add the environment variables from the next section.
5. Deploy, then attach the domain under **Settings → Domains** and point DNS at
   Vercel.
6. The crons in `apps/tasks/vercel.json` are picked up automatically per project
   — the attachment reconciler and the hourly digest worker. Nothing to
   configure beyond `CRON_SECRET`.

### 6. Environment variables for the new Vercel project

Required — the app will not function without these:

| Variable                               | Value                                                        |
| -------------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | new project's URL                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | new project's publishable key                                |
| `SUPABASE_SECRET_KEY`                  | new project's secret key — server only, never `NEXT_PUBLIC_` |
| `TASKS_APP_URL`                        | `https://tasks.example.com`                                  |
| `NEXT_PUBLIC_TASKS_APP_URL`            | same value                                                   |
| `CRON_SECRET`                          | fresh per instance: `openssl rand -base64 32`                |

Email, needed for digests and reminders:

| Variable                                     | Value                                                       |
| -------------------------------------------- | ----------------------------------------------------------- |
| `RESEND_API_KEY`                             | a **separate** key — see step 7                             |
| `TASK_DIGEST_FROM_EMAIL`                     | `Example Tasks <tasks@example.com>`, from a verified domain |
| `RESEND_DAILY_QUOTA`, `RESEND_MONTHLY_QUOTA` | optional; default 100 / 3000                                |

Google Calendar, optional:

| Variable                                                     | Value                                             |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | OAuth web client                                  |
| `GOOGLE_CALENDAR_TOKEN_KEY`                                  | **fresh per instance**: `openssl rand -base64 32` |
| `GOOGLE_CALENDAR_ID`                                         | the workspace calendar to sync                    |

Branding: set only `NEXT_PUBLIC_TASK_KEY_PREFIX` (and
`NEXT_PUBLIC_CHANGELOG_VERSION_PREFIX` if it should differ). Everything else in
the environment-variable table is a _default_ for a value that `/admin/settings`
can change at runtime, so leave the rest unset and configure the instance from
the UI after the first deploy.

Choose the task key prefix carefully. It appears in every task URL
(`/task/ABC-142`), so changing it later breaks existing links.

`TASKS_ALLOWED_ORIGINS` is only needed if preview deployments must issue writes.

#### Never borrow the other instance's Supabase credentials

The three Supabase variables must all come from the new project, and the
temptation to paste the working instance's values in while debugging a signup
or redirect problem is the single most expensive mistake available here. It
does not fail loudly: the app comes up, signs in, and serves the _first_
instance's users, projects, and categories under the second instance's domain.
Anything written in that state lands in the wrong database.

Two properties make it hard to see afterwards:

- `NEXT_PUBLIC_*` values are inlined at build time, so a deployment keeps
  talking to whatever project it was built against. Correcting the variables
  changes nothing until a **fresh** deployment is built — redeploying an older
  one can reuse its previous environment snapshot.
- The database-contract preflight only checks whether the configured project
  has the schema, not whether it is the right project. A deploy pointed at the
  wrong database passes it.

If it has already happened, restore the variables from the correct project,
push any migrations the new database is missing, and trigger a fresh
deployment from `main`. Then confirm on the running site that
`/admin/integrations` shows the intended Supabase host.

### 7. Third-party accounts

- **Resend.** `lib/server/resend-usage.ts` reads account-wide quotas, so two
  instances sharing one API key double-count on `/admin/usage`. Use a separate
  key, and a separate verified sending domain either way.
- **Google Calendar.** One OAuth client can hold both redirect URIs, or create a
  second for cleaner consent-screen branding. `GOOGLE_CALENDAR_TOKEN_KEY` must
  be generated fresh — it encrypts the stored refresh tokens, and sharing it
  across instances means either can decrypt the other's.

### 8. First-run checklist

1. Sign in at `https://tasks.example.com/login`.
2. Open `/admin` — if it 404s, `app_role` is not `owner`; revisit step 4.
3. `/admin/settings`: set the name, description, accent, and logo. Blank fields
   inherit the compiled default, shown as the input's placeholder.
4. `/admin` overview: confirm every integration reports Configured or Connected.
5. `/admin/statuses`: confirm the six seeded statuses, adjust to taste.
6. `/admin/access`: invite your team.
7. Create a task and confirm the key renders with your prefix.
8. After the first cron window, check `/admin/usage` for a digest run.

### 9. Ongoing

Both instances deploy from `main`. A schema change now needs a migration file
committed to the repo and pushed to **both** projects — the practice step 1
establishes is not optional once a second database exists. Deploy the code and
apply the migration in whichever order suits; `lib/server/instance-settings.ts`
already tolerates its own table being absent, but nothing else does, so keep the
window short.

## What is already configurable

### The two tiers

**Build-time (`instanceBuild` in `lib/instance.ts`).** The task key prefix and
changelog version prefix. These compose identifiers: the task key prefix appears
in every task URL and is consumed by `taskKey()`, a pure synchronous function
called from client modules and URL parsing. They cannot vary per request, and
editing one at runtime would break every existing task link. `/admin/settings`
shows them read-only with the variable that changes them.

**Runtime (`InstanceSettings`).** Presentational values include the name,
description, monogram, accent, logo, fixed footer content, and the link
preview's badge and alt text. There is one name, not two: the instance name is
the wordmark, the page title, the digest email's header, and the words printed
on the link-preview card, which composes from the identity rather than carrying
copy of its own. For editable values, a blank field on `/admin/settings` is not a missing value — it stores
NULL, which means "inherit the build-time default", and the form shows that
default as the input's placeholder so the two are always distinguishable.
`lib/server/instance-settings.ts` reads the `instance_settings`
singleton, layers it over the compiled defaults, and caches the result per
request. `app/layout.tsx` seeds `InstanceProvider` so client components read the
resolved values synchronously through `useInstance()`.

The compiled defaults are unbranded. A deployment that sets nothing and has no
stored row presents as an unnamed **Workspace**, with no footer subtitle or
social links, rather than borrowing another
deployment's identity — so a new instance is never mistaken for Ryan Meetup
before its owner has configured it. Tasks always uses the same compact footer
layout; owners customize its wordmark, links, socials, and credit rather than
choosing a different presentation. Only the wordmark is runtime-editable; the
remaining footer content comes from the compiled defaults.
Ryan Meetup is an instance like any other: it names itself through the variables
below or `/admin/settings`, and a Ryan Meetup deployment that sets neither will
render as `Workspace`. `tests/unit/instance.test.ts` covers defaults, env
overrides, the stored-override merge, and the validation rules, and asserts that
no Ryan Meetup identity survives in the compiled defaults.

One Ryan Meetup value is deliberately still a default, because neutralizing it
is not free: `NEXT_PUBLIC_INSTANCE_ACCENT` defaults to `#ee1a25`, the nametag
red, which also reaches email HTML. It is a color rather than a mark, so it is
not recognizable as Ryan Meetup on its own.

`metadataOrigin()` in `lib/app-url.ts` names no deployment either. With
`TASKS_APP_URL` unset it degrades through the origin of the request being
served, then `VERCEL_PROJECT_PRODUCTION_URL`, then `http://localhost:3000`, so
an unconfigured build's `og:url` points at itself rather than at Ryan Meetup.

The local `.env.example` also lists these, but note it is **gitignored** by the
`.env*` rule in `apps/tasks/.gitignore`, so it does not survive a fresh clone.
The table below is the durable reference.

| Concern                                   | Owner                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Wordmark in header, sidebar, sign-in card | `components/global/InstanceWordmark.tsx`                                                     |
| Uploaded logo                             | `/admin/settings`, stored in the `instance-assets` bucket                                    |
| Fallback logo                             | `NEXT_PUBLIC_INSTANCE_LOGO_PATH`, a root-relative path in `public/`                          |
| Page titles                               | `pageTitle()` from `lib/server/instance-settings.ts`; `useInstancePageTitle()` on the client |
| Root metadata and Open Graph card         | `app/layout.tsx`, `app/opengraph-image.tsx`                                                  |
| Task key prefix (`TASK-142`)              | `NEXT_PUBLIC_TASK_KEY_PREFIX`, consumed by `lib/tasks/task-key.ts`                           |
| Changelog version format (`TASK v0.9.0`)  | `NEXT_PUBLIC_CHANGELOG_VERSION_PREFIX`, defaults to the task key prefix                      |
| Digest email branding                     | `lib/server/task-digest-email.ts`                                                            |
| Fixed footer content, socials, credit     | `components/navigation/TasksFooter.tsx`, `packages/ui/src/SiteFooter.tsx`                    |
| Social platform icons and labels          | `lib/instance-socials.tsx`                                                                   |
| Accent color outside Tailwind tokens      | `NEXT_PUBLIC_INSTANCE_ACCENT`                                                                |
| Banner notice and where its link goes     | `/admin/settings` → Banner; `lib/banner.ts` composes the sentence                            |

### Environment variables

All are optional and client-visible. Because Next.js inlines `NEXT_PUBLIC_*`
values at build time, a change requires a rebuild, not just a restart. Editable
identity values are defaults that a stored `instance_settings` value can
override. Footer presentation is fixed from its compiled values; only the
identity wordmark or logo displayed in its existing slot changes at runtime.

| Variable                                 | Default                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_INSTANCE_NAME`              | `Workspace` — Ryan Meetup's own deployment sets this to `Ryan Meetup`         |
| `NEXT_PUBLIC_INSTANCE_DESCRIPTION`       | derived from a configured name; otherwise a generic shared-workspace sentence |
| `NEXT_PUBLIC_TASK_KEY_PREFIX`            | `TASK` — 1-10 alphanumerics starting with a letter; Ryan Meetup sets `RMT`    |
| `NEXT_PUBLIC_CHANGELOG_VERSION_PREFIX`   | the task key prefix                                                           |
| `NEXT_PUBLIC_INSTANCE_ACCENT`            | `#ee1a25` — six-digit hex                                                     |
| `NEXT_PUBLIC_INSTANCE_LOGO_PATH`         | none; root-relative path in `public/`                                         |
| `NEXT_PUBLIC_INSTANCE_MONOGRAM`          | first letter of the name                                                      |
| `NEXT_PUBLIC_INSTANCE_BANNER`            | `true` — `false` hides the notice above the workspace                         |
| `NEXT_PUBLIC_INSTANCE_BANNER_MESSAGE`    | `This workspace is in beta. Found an issue or have an idea?`                  |
| `NEXT_PUBLIC_INSTANCE_BANNER_LINK_URL`   | `mailto:ryan@ryanmeetup.com` — an `https://` page or a `mailto:` address      |
| `NEXT_PUBLIC_INSTANCE_BANNER_LINK_LABEL` | none — the label is derived from the address                                  |
| `NEXT_PUBLIC_INSTANCE_OG_ALT`            | `<name> — private team workspace`                                             |
| `NEXT_PUBLIC_INSTANCE_FOOTER_SUBTITLE`   | none — Ryan Meetup's own deployment sets `NO BRYANS ALLOWED`                  |
| `NEXT_PUBLIC_INSTANCE_CREDIT_PREFIX`     | `Website designed and developed by `                                          |
| `NEXT_PUBLIC_INSTANCE_CREDIT_LABEL`      | `Ryan Le`                                                                     |
| `NEXT_PUBLIC_INSTANCE_CREDIT_URL`        | `https://ryanle.dev/`                                                         |
| `NEXT_PUBLIC_INSTANCE_CREDIT_SUFFIX`     | `. All Rights Reserved.`                                                      |

The footer link columns and social icons have no environment variables: they
are lists rather than scalars, so the compiled defaults in `lib/instance.ts`
are their source of truth. The default sections describe the stack the app is
built on, which is true of every deployment; the default socials list is
**empty**, because accounts belong to an instance rather than to the codebase.

Notes on the design:

- The task key prefix is **display-only**. `task_number` is a database column;
  changing the prefix renames what users see and does not touch stored data.
  It does, however, change every `/task/<key>` URL, so an existing deployment
  that was relying on the old `RMT` default must set
  `NEXT_PUBLIC_TASK_KEY_PREFIX=RMT` to keep its shared links resolving.
- The prefix, accent color, and logo path are validated at module load and throw
  on malformed input, because they are interpolated into regular expressions,
  inline email styles, and an image URL respectively.
- Changelog markdown frontmatter carries a quoted semantic version
  (`version: "0.9.0"`) and the display string is composed at read time. The
  changelog is the _app's_
  release history, so every instance shows the same entries under its own
  prefix. If an instance should have its own entries, scope
  `changelogDirectory` in `lib/server/changelog.ts` per instance.
- **The banner says whatever the instance writes, and never composes the
  instance name.** A sentence assembled from the wordmark — "ACME is in beta."
  — reads as though the product were named after whoever the workspace belongs
  to; the name is one deployment's identity, not this app's. The compiled
  default announces the beta without naming anyone, and an instance replaces it
  from **Banner** on `/admin/settings` with a maintenance window, a policy
  note, or anything else it needs above the workspace.
- **The banner link is the one place the maintainer is named, and that is
  deliberate.** Its default destination is `mailto:ryan@ryanmeetup.com` for the
  same reason the build credit is: it names who wrote and maintains the
  software, which is true of every deployment, rather than who the workspace
  belongs to. An unlabelled link phrases itself from its address — `Email
ryan@ryanmeetup.com` for a mailbox, `Learn more` for a page — so an instance
  only writes a label when it wants different words.
- **A bare `mailto:` opens a prefilled draft.** `bannerMailtoHref` in
  `lib/banner.ts` seeds the subject and the two questions whoever reads the
  mail would otherwise have to ask, because a banner that invites a bug report
  and opens an empty message gets empty messages back. The subject names the
  workspace — inbox metadata for an address that may take mail from more than
  one instance, not part of the notice. Stored settings stay a plain address,
  and an owner who writes their own query string, or an `https://` page, is
  left exactly as given.
- The switch and the link are the exception to "blank means inherit". They are
  seeded from the resolved value and written explicitly, because an unticked
  box and an empty link are choices in their own right; only values that
  actually change are sent, so an untouched dialog still inherits. The message
  and the link label are ordinary overrides: blank falls back to the compiled
  notice and to the derived label. Because a cleared link is stored as `NULL`,
  `banner_link_url` carries the maintainer address as a column default: a row
  created by saving some *other* setting would otherwise read as an instance
  that had chosen to send people nowhere.
- **Tasks has one compact footer layout.** Its uploaded instance logo (or text
  fallback) comes from editable identity settings and renders in the current
  wordmark slot. Its subtitle, inline links, social icons, and credit sentence
  are fixed; Tasks exposes no footer editor, presentation variants, or hide
  control. The shared `SiteFooter` still provides the larger marketing layout
  to the public sites.
- **Socials are a list keyed by platform**, not a column per network, so the
  four Ryan Meetup happens to use do not read as the only ones that exist.
  Adding a network is an entry in `socialPlatforms` plus the two maps in
  `lib/instance-socials.tsx` — no migration and no new form field.
- Editable destination URLs are validated at the API boundary. The banner link
  accepts `https` and `mailto`, while uploaded logo paths are
  limited to root-relative or `https` locations.
- Deployment-level settings — Supabase, Resend, Google, app URL, cron secret —
  were already environment-driven and needed no change. They are reported
  read-only on `/admin/settings` via `lib/server/integration-health.ts`, which
  masks every secret down to a four-character fingerprint. They are deliberately
  not editable: they live in the hosting environment, changing one needs a
  redeploy anyway, and storing them in the database to render into a form would
  turn one compromised owner session into full credential disclosure.
- `lib/server/instance-settings.ts` tolerates the `instance_settings` table not
  existing (Postgres 42P01 / PostgREST PGRST205) and falls back to the compiled
  defaults with a warning. That is narrow on purpose — it covers the window
  between deploying the code and applying the migration, in either order. Every
  other database failure propagates.

## Known rough edges

- **Demo mode is intentionally neutral.** A workspace running without Supabase
  credentials uses the generic identity in `lib/instance.ts`, the sample team
  and projects in `lib/workspace/demo-data.ts`, `TASK-` task keys, and a minimal
  footer. Keep this path free of deployment-specific branding because it is
  also the app's zero-configuration first impression. The `/admin` section is
  hidden there — `app/admin/layout.tsx` redirects to `/`, and the header drops
  its Admin entry points — because none of those screens can persist a change
  without a database. The one value demo mode keeps from this build is the
  footer credit: it names who wrote the software rather than whose workspace
  this is.

  An owner of a configured deployment can enter the same demo from the Admin
  overview. `POST /api/admin/demo-preview` sets an httpOnly cookie, and
  `isWorkspaceDemo()` honors it only after `is_app_owner` confirms the caller,
  so a forged cookie gets the real app. The preview is per-browser, writes
  nothing, expires in four hours, and is left from the demo banner, since
  entering it hides the admin section that turned it on.

- **The brand theme is shared.** `packages/brand/theme.css` provides Cooper
  Black and the nametag red to every app in the monorepo. A second instance
  currently inherits the Ryan Meetup look apart from
  `NEXT_PUBLIC_INSTANCE_ACCENT`. Tokenizing the display font and full palette
  per instance is a separate, larger piece of work.
- **Two time zones, one configurable.** The digest worker reads its zone from
  `digest_settings.time_zone` (default `America/New_York`), but
  `WORKSPACE_TIME_ZONE` in `lib/calendar/google-calendar-sync.ts` is still a
  compiled constant with the same value. An instance in another zone will get
  correctly timed digests and misaligned calendar day boundaries until the
  calendar constant follows the same pattern.
