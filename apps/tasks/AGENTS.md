# Ryan Meetup Tasks Instructions

These instructions supplement the repository-root `AGENTS.md` for work in
`apps/tasks`.

## Current architecture

The Tasks app is a private Next.js App Router workspace backed by Supabase. It
also has a local demo mode when the public Supabase environment variables are
absent. Preserve both paths when changing workspace behavior.

Code is organized by responsibility:

- `app/**/page.tsx` files are server-side route composition. They authenticate,
  load only the collections a page needs, interpret shareable query state, and
  pass initial data to a feature page client.
- `app/api/**/route.ts` files are HTTP boundaries. They authorize, parse and
  validate input, dispatch domain operations, and format responses. Keep
  database workflows and reusable query logic in `lib/server`.
- `components/<feature>` owns feature presentation and client orchestration.
  Large interactions should be split into focused views, panels, fields, and
  controller hooks instead of accumulating in a page client or modal.
- `components/global` is for Tasks-only UI used by several features. Generic,
  brand-consistent primitives still belong in `@ryanmeetup/ui`. Screens lead
  with `PageHeader` rather than composing their own kicker, heading, and
  description, so the icon treatment and spacing stay identical everywhere; a
  page's icon is the one its sidebar or admin tab entry already uses.
- `hooks` owns reusable Tasks client controllers. Keep feature-specific hooks
  beside their feature when they are not shared across the app.
- `lib` owns framework-light domain types, selectors, parsing, normalization,
  state reconciliation, and client mutation services. Domain code is grouped
  under `lib/access`, `lib/activity`, `lib/calendar`, `lib/contacts`,
  `lib/resources`, `lib/tasks`, and `lib/workspace`; keep cross-domain modules
  at the `lib` root only when no single domain is the correct owner.
- `lib/server` is the server-only application layer: authorization, request and
  response handling, privileged operations, persistence, and query services.
  Client modules must never import it, including indirectly through a barrel.
- `lib/supabase` owns browser and server client construction only.
- `lib/instance.ts` owns every value that differs between deployments of this
  codebase, in two tiers. `instanceBuild` is compiled in and holds the values
  that compose identifiers (task key prefix, changelog version prefix).
  `InstanceSettings` is presentational and is overridable at runtime from the
  `instance_settings` table through `/admin/settings`. Never hardcode Ryan
  Meetup branding in a component, page title, or email: read it from
  `getInstanceSettings()` on the server or `useInstance()` on the client, and
  give every value a Ryan Meetup default. See `docs/MULTI_INSTANCE.md`.
- `app/admin` is the owner-only section: overview, statuses, access, usage, and
  settings. Every admin page passes `{ owner: true }` to `loadWorkspacePage`
  and renders its content inside `AdminPageShell`, which owns the tab strip,
  page padding, and content width so tabs never shift between screens; admin
  clients must not set those themselves. New owner-only tools belong here and
  in `lib/admin/admin-routes.ts`, not as another control in the header.
- Schema changes are migrations in `supabase/migrations`, applied with
  `supabase db push` on RMT. `supabase/migration-scopes.json` lists RMT-only
  extensions; all other migrations are shared Tasks schema. PRD receives the
  scoped planner's shared-only dashboard SQL. Applied SQL files stay immutable.
  `20260731000000_baseline_schema.sql` reproduces the whole
  database, and `supabase/seed.sql` seeds the rows a workspace needs; verify a
  change with the isolated profile runner then `supabase db diff --linked`. Never change
  the schema only in the dashboard, and never delete an applied migration file —
  doing that is what left 67 orphaned history rows and no baseline until now.
  See `docs/DATABASE.md`.
- Code that reads a table added by an unapplied migration may tolerate a
  missing relation through `isMissingRelation` in `lib/server/supabase-errors.ts`
  and fall back to defaults, so deploy order does not matter. That tolerance is
  only ever for a missing table; every other database failure must propagate.

Use `@/` for app-owned absolute imports. Prefer domain-owned types such as
`lib/tasks/task-types.ts`, `lib/workspace/workspace-types.ts`,
`lib/resources/resource-types.ts`, and `lib/activity/activity-types.ts`; do not
grow `lib/types.ts` into a new catch-all. Keep feature `index.ts` exports narrow
and intentional. Code within a feature should usually import its siblings
directly rather than expanding a barrel solely for internal use.

## Server pages and workspace data

- Use `loadWorkspacePage` for authenticated workspace pages. Its options own
  owner checks and onboarding redirects; do not reproduce that flow in pages.
- Ask `loadWorkspacePage` for only the `WorkspaceCollection` values required by
  the page, then issue page-specific queries explicitly. Keep stable selection
  strings in `WORKSPACE_COLUMNS` or `database-shapes.ts` rather than allowing
  query shapes to drift.
- Pass Supabase results through `requireQueryData` or `requireQueryResult`.
  Silent `data ?? []` fallbacks can hide authorization, schema, and network
  failures and are not acceptable for required data.
- Keep initial database loading in Server Components. Client page components
  receive typed initial data and coordinate interaction; they must not become a
  second server-loading layer.
- `searchParams` is asynchronous in this Next.js version. Type it as a promise
  and await it before reading values.
- Public task references use readable `<prefix>-<number>` keys built by
  `lib/tasks/task-key.ts`, where the prefix is per-instance and defaults to the
  neutral `TASK` for every build until an instance sets its own.
  Never hardcode the prefix. UUIDs remain internal identifiers and must
  not replace task keys in navigation or shared URLs.
- Prefer human-readable route segments over raw ids. A URL is something people
  read, paste into a message, and edit by hand, and
  `/contacts/d0d2b336-1f78-4d00-a412-5cc6b0a517d9/edit` tells the reader nothing
  about which contact it opens. Name the resource with a slug and let the id
  remain the fallback for the cases a slug cannot decide —
  `lib/contacts/contact-slug.ts` resolves a duplicated display name that way,
  and `lib/tasks/task-key.ts` is the same rule with a per-instance key. A
  readable URL is still untrusted input: a slug resolves only against what the
  viewer may read, and `editorBackHref` refuses a `?from=` that is not a
  same-origin absolute path.
- Prefer state the browser already keeps over state encoded in a URL. An editor
  route reached from a single surface needs no `?from=`: `router.back()` returns
  to the list with its search and scroll intact, and a constant href covers the
  direct-open case — see `components/contacts/ContactEditorPageClient.tsx`.
  `?from=` earns its place only where an editor is opened from several
  surfaces, as the task and calendar-event routes are.
- A dedicated create/edit route is a page, not a dialog that happens to have a
  URL. It gets a breadcrumb trail, a `PageHeader`, `Card` sections that scroll
  with the document, and its commit actions under the fields they save — never
  a bordered card with a corner close button and a pinned action bar. Render
  through `EditorSurface`, whose `presentation: "page"` branch is the only
  place that shape is written. See `docs/MOBILE_EDITOR_SURFACES.md` and
  `components/contacts/ContactEditor.tsx`.
- Which surface a person gets is their own choice, not the viewport's alone.
  `profiles.editor_surface` is `auto`, `modal`, or `page`, and every create or
  edit affordance asks `editorTriggers` from `components/global` which halves
  of its trigger pair to render rather than reaching for a class name. A
  trigger that renders only one half leaves the other preference with no way
  in.

`useWorkspaceData` owns the live client workspace. Demo persistence,
realtime subscription setup, pure event reconciliation, and mutation behavior
have separate owners. Extend `lib/workspace/workspace-realtime.ts`,
`lib/workspace/workspace-reconciliation.ts`, or a domain mutation service
instead of adding unrelated behavior to the hook. Access-preview sessions
intentionally do not subscribe to realtime updates.

## Client feature boundaries

Keep page clients and top-level feature components focused on composition:

- `TaskApp` coordinates the workspace and selects board/list presentation.
  Board rendering belongs in `TaskBoardView`, list rendering in the list view,
  drag behavior in `useTaskBoardDrag`, and editor lifecycle in
  `useTaskEditorController`.
- Task drafts, scheduling, query parsing, filtering, view derivation, and
  mutation behavior belong in their named `lib/tasks/task-*` modules. Use pure
  helpers for rules that can be tested without React.
- Category and project screens may share neutral fields, links, attachment UI,
  and persistence machinery through `components/resources`,
  `lib/resources/resource-*`, and `lib/server/resource-*`. Their distinct
  domain rules, permissions, copy, and state remain in their feature
  directories.
- Access screens compose panels and dialogs. Effective-permission derivation
  belongs in `lib/access/access-selectors.ts`, client mutation coordination in
  `useAccessManagement`, and server workflows in the access-group operation and
  service modules.
- Search ranking/href generation, activity presentation, notes behavior, and
  workspace reconciliation belong in their framework-light domain modules,
  with UI components limited to interaction and rendering.

Do not extract code merely to reduce line count. Extract when a module gains a
clear owner, a reusable contract, or an independently testable rule. Avoid
generic `utils.ts`, `helpers.ts`, broad state bags, and full `WorkspaceData`
props when a component can receive a narrower view model or controller.

## Mutations and API contracts

- Browser writes go through same-origin API routes and the shared
  `mutate`/`parseMutationResponse` client helpers. Do not write protected
  workspace data directly from components.
- JSON mutation routes must use `readJson` and a schema from `lib/api-schema`
  (whose `index.ts` is the deliberate public surface). This preserves origin,
  content-type, body-size, unknown-key, and field validation.
- Route handlers must use `authorize` and return the shared structured API
  errors. Database failures go through `databaseFailure` so correlation IDs and
  safe error mapping remain consistent; do not expose raw Supabase errors.
- Multi-row or authorization-sensitive writes belong in transactional database
  functions. Call the canonical RPC rather than recreating a partial sequence
  of table writes in TypeScript.
- Client mutation services own optimistic updates and rollback. Apply returned
  canonical rows to workspace state so database normalization and triggers are
  reflected in the UI.
- File attachment routes use the shared resource attachment request, storage,
  and persistence modules. Preserve size/count enforcement and cleanup of
  partially completed storage/database operations.

## Authorization and data privacy

Read `docs/access-control-spec.md` before changing access groups, categories,
projects, tasks, attachments, membership, page access, RLS, or privileged APIs.
Its security invariants are requirements, not implementation suggestions.

- Supabase RLS and database functions are the security boundary. UI filtering,
  hidden controls, access previews, and route-level checks are defense in depth,
  never substitutes for RLS.
- Authorization must fail closed. Missing grants, ownership metadata, or
  rollout state must deny access or block the migration; never broaden access.
- App ownership, organizational tiers, lateral teams, project grants, category
  restrictions, page restrictions, and projectless-task rules are distinct
  concepts. Reuse the canonical selectors and RPCs instead of approximating
  effective permission in a component.
- A whole page can be locked behind access groups. The lockable pages are the
  registry in `lib/access/workspace-areas.ts`; a page reads its own gate
  through `loadWorkspacePage({ area })` and `authorize({ area })`, and the
  sidebar hides what the member cannot open. Adding a lockable page means an
  entry there, the RLS predicate for its tables, and the guard on its routes —
  never a new boolean on `access_groups`.
- Owner-only access metadata must not be selected into regular-member payloads.
  Use the privileged server client only inside the established privileged API
  boundary and only after the corresponding authorization check.
- Preserve audit activity and transactional behavior when changing mutations.
  A successful content write must not silently lose its required audit record.
- Access preview is an owner-only diagnostic view, not impersonation and not an
  authorization mechanism.

## Database naming and migrations

The UI calls `work_groups` “categories.” Preserve that product terminology at
the UI/domain boundary and the existing table name at the database boundary;
do not introduce a second competing name casually.

Schema changes follow the repository policy in the root `AGENTS.md` under
"Supabase database changes": every change is a committed migration file in
`supabase/migrations`. Declare RMT-only versions in
`supabase/migration-scopes.json`; `store_`/`rmt_` files require an explicit entry.
Verify both profiles through the isolated test runner before applying a change,
then use `supabase db diff --linked` for RMT. Never apply an RMT schema change
only in the dashboard, and never delete an applied migration file. Keep changes
idempotent where practical and
document security-sensitive behavior in the access-control specification.
`docs/DATABASE.md` has the full workflow and the history behind it.

### Who applies database fixes, per instance

The two instances are reached differently, so a database fix is handed over
differently depending on which one it is. See `docs/DATABASE.md` for the full
split.

- **RMT (`tasks.ryanmeetup.com`, ref `lvfaartgcpphuokoswcm`).** This machine is
  linked and authenticated. Run the `supabase` commands yourself and verify the
  result rather than handing Ryan a manual step.
- **PRD (`projects.ryanle.dev`, ref `vjsnobmfsfrsnwukfaoq`).** This machine's
  Supabase login has no access to that project, so `supabase link` and
  `supabase db push` cannot reach it. Never hand over CLI commands for PRD.
  Only shared Tasks migrations apply here. Use `scripts/build-catchup-sql.mjs`
  (PRD is its default target) to exclude RMT-only SQL and prerequisites. Never
  fabricate applied versions for excluded extensions or remove already-applied
  extension objects/history. Give Ryan the exact SQL to paste into the PRD
  Supabase dashboard's **SQL Editor** instead — copied from the committed migration, complete, runnable as
  one block, and safe to re-run where practical. Include a separate verification
  query with the expected result, and say explicitly that both blocks run on
  PRD. Do not substitute a migration filename, repository link, prose summary,
  or CLI command for the paste-ready SQL.

## Demo mode

Demo mode is a supported local product path, not test scaffolding. It is also
reachable from a configured deployment: an app owner can turn on demo preview
from the Admin overview and leave it from the demo banner. Because of that
`isWorkspaceDemo()` is async and owner-checked — await it, and never branch on
`isDemoBuild` on the server when you mean "is this request a demo". When a
workspace mutation is available in demo mode, keep its in-memory/local-storage
semantics aligned with the server-backed path, including normalized task
schedules, completion/archive lifecycle, relationships, and cleanup. Features
that cannot be safely simulated should be explicitly disabled with clear UI
rather than failing through an API call.

## UI conventions specific to Tasks

- Use the Inter variable font and established Tasks surfaces; Cooper remains
  reserved for intentional Ryan display moments inherited from the shared
  brand system.
- Resource create/edit dialogs use the shared `Modal` as a scroll-bounded
  shell. Use a concise `New {resource}` or `Edit {resource name}` title, keep
  explanatory copy in `description`, place the fields in a real form with a
  stable ID, and connect footer submit buttons with the `form` attribute. Keep
  Cancel before the primary create/save action, expose the mutation through the
  button's loading state, disable dismissal and editable controls while the
  mutation is pending, and autofocus the primary field when the dialog opens.
  Let `Modal` own the fixed header, scrolling body, scroll affordance, and
  fixed footer instead of recreating those regions inside feature code.
- Editors for collections nested inside a resource dialog use one active
  editor above the compact collection rows. Adding or editing an item replaces
  that active editor rather than expanding multiple forms throughout the list.
  Keep the fields needed for routine entry visible; when secondary fields make
  an editor genuinely dense, place only those fields behind `AnimatedCollapse`.
  Return completed items to summary rows and use shared `IconButton` controls
  for row editing and removal. Show a collection count; add the standard
  debounced search treatment when the collection is large enough to need
  filtering.
- On management cards and other compact resource rows, use the shared
  `IconButton` for edit, archive, restore, delete, favorite, and similar
  secondary actions, matching the Projects and Work Groups screens. Give every
  icon action a specific accessible label that includes the resource name. Do
  not replace these compact controls with exposed text-and-icon buttons unless
  the action is the card's primary call to action or the text is needed to
  prevent ambiguity.
- Full-page resource-management screens must use the shared `ManagementSurface`
  established by Projects and Work Groups: the page title and concise
  description belong in the shell header, the primary page action belongs in
  its `actions` slot, and the resource controls, results, and empty state belong
  in the bordered shell body. Use the standard Tasks page padding
  (`p-3 sm:p-6 lg:p-6 xl:p-8`) and avoid adding a separate marketing-style page
  hero or stacking another full-size surface around the embedded shell.
- Expandable and collapsible interface regions should use the shared
  `AnimatedCollapse` transition established by the sidebar so motion, overflow,
  and reduced-motion behavior remain consistent. Drive it from a real button
  with `aria-expanded` and `aria-controls`, rotate its disclosure indicator in
  sync with the shared 200 ms transition, and choose the initial open state
  deliberately for the content rather than relying on native `details` styling.
- Reuse `@ryanmeetup/ui` fields, dialogs, menus, filters, feedback, toast, and
  loading primitives before adding Tasks-local equivalents.
- Every breadcrumb in the Tasks app must give each route a meaningful icon.
  The final breadcrumb represents the current page and must render as plain
  text with `aria-current="page"`, never as a link back to the page already
  being viewed. Use the shared `Breadcrumbs` component so this behavior stays
  consistent.
- Preserve the light/dark theme bootstrap and CSP nonce. New inline scripts are
  exceptional and must be compatible with the nonce-based policy.
- The app is private and must remain `noindex` through metadata, `robots.ts`,
  and response headers.
- Search and filtering changes must follow the root debounced-search contract.
  Query parameters should be readable and stable, and owner access-preview
  parameters must survive relevant navigation and API requests.
- For optimistic or autosaved interactions, expose pending/error state and
  guard against stale responses overwriting a newer draft.

## Tests and validation

Put pure domain coverage in `tests/unit`, route contract coverage in
`tests/routes`, and browser behavior in `tests/e2e`. Every bug fix or extracted
rule should gain the narrowest useful regression test.

For Tasks changes, run from the repository root as applicable:

```sh
npm run lint --workspace=@ryanmeetup/tasks -- --no-cache
npx tsc --noEmit -p apps/tasks/tsconfig.json
npm test --workspace=@ryanmeetup/tasks
npm run test:e2e --workspace=@ryanmeetup/tasks
npm run build --workspace=@ryanmeetup/tasks
git diff --check
```

At minimum, lint changed TypeScript/TSX, run TypeScript, relevant unit tests,
and `git diff --check`. Add the production build for page, route, server,
configuration, or package changes; live verification for database/RLS/RPC
changes; and Playwright plus responsive visual checks for interaction or layout changes.
Report an environmental or pre-existing failure exactly rather than calling the
check successful.

## Page metadata titles

Every page must set an explicit absolute metadata title ending in
`| Ryan Meetup Tasks`. Do not rely on the root layout's `title.template`:
Next.js does not apply that template to a page in the same route segment, which
can produce inconsistent browser-tab titles.

Build titles with `pageTitle` from `lib/server/instance-settings.ts`. It resolves
the runtime product name, so it is async and every page uses `generateMetadata`:

```tsx
export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: await pageTitle("Dashboard") } };
}
```

Task detail pages use `await pageTitle(`${taskKey(task)}: ${task.title}`)`.
Client components that set `document.title` use `useInstancePageTitle()` from
`@/components/global` instead.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
