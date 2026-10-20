# Ryan Meetup Monorepo Instructions

This file is the source of truth for agents working in this repository. Apply
these rules to every workspace unless a more specific `AGENTS.md` exists lower
in the directory tree.

## Goal

Keep every Ryan Meetup app recognizably part of the same product family while
keeping code small, reusable, accessible, and easy to change. Prefer one shared
implementation over parallel app-local versions, but do not force app-specific
business logic into a generic package.

## Repository Map

- `apps/ryanmeetup`: the primary Ryan Meetup site.
- `apps/ryancon`: the RyanCon site.
- `apps/tasks`: task-management app and workspace.
- `packages/brand`: shared fonts and brand theme CSS.
- `packages/ui`: reusable visual primitives and generic compositions.
- `packages/contact`: shared contact-form behavior and integrations.
- `packages/hooks`: reusable client-side state and query hooks.
- `packages/sponsors`: shared sponsor-domain components.
- `packages/utils`: framework-agnostic shared utilities.

The repository uses npm workspaces. Use the workspace scripts in the root
`package.json` or run scripts from the relevant app directory.

Each app's `dev` script pins its own port so two apps never race for one, and
so a Playwright run never lands on whichever app happened to claim it first:
tasks 3000 (its Supabase auth callbacks are registered there), ryanmeetup 3001,
store 3002, ryancon 3003. End-to-end servers run higher and separately —
tasks 3100, ryanmeetup 3101 — each overridable with `PLAYWRIGHT_PORT`.

## The two Tasks instances

`apps/tasks` backs two deployments that share this repository and the `main`
branch but are otherwise completely separate — separate users, projects,
categories, and privileges:

| | Domain | Vercel org | Supabase project |
| --- | --- | --- | --- |
| RMT | `tasks.ryanmeetup.com` | `teamryan` | `lvfaartgcpphuokoswcm` |
| PRD | `projects.ryanle.dev` | `ryansles-projects` | `vjsnobmfsfrsnwukfaoq` |

Same Vercel account, different orgs. Different Supabase *accounts*, each with
its own storage buckets. Both receive every feature on merge, which is the
point of not forking.

How to work with them:

- **Never point one instance at the other's Supabase credentials, not even as a
  temporary diagnostic.** It fails silently — the app builds, signs in, and
  serves the other workspace's data under the wrong domain, and anything
  written lands in the wrong database. This has happened once already.
- Every migration must be pushed to **both** projects. See "Supabase database
  changes" below; a schema change applied to one and not the other is exactly
  the drift that broke PRD's deploys.
- `NEXT_PUBLIC_*` values are inlined at build time, so a deployment keeps
  talking to whatever project it was built against. After changing environment
  variables, trigger a **fresh** deploy from `main` — redeploying an older one
  can reuse its previous environment snapshot.
- When a change is instance-specific, express it through `instance_settings`
  and `/admin/settings` rather than branching on the domain in code. A blank
  setting inherits the compiled default; see `lib/instance.ts`.
- Nothing in the repository names PRD's credentials. To check what a running
  instance actually resolved, read `/admin/integrations` rather than guessing
  from a local `.env.local`.

Fuller detail lives in `apps/tasks/docs/MULTI_INSTANCE.md`.

## Before Making Changes

1. Inspect the relevant app and shared packages before adding a component,
   utility, token, dependency, or interaction.
2. Search with `rg` for an existing implementation and for similar UI in the
   other apps.
3. Check `@ryanmeetup/ui` before using a native control or building an
   app-local UI solution. When a suitable shared component exists, use it;
   use native elements directly only when the shared package has no appropriate
   component or there is a documented semantic or behavioral reason.
4. Preserve unrelated work in the worktree. Do not overwrite or reformat files
   outside the requested scope.
5. Treat the current source code and this file as more authoritative than old
   transfer guides. Update stale documentation when a change makes it wrong.

## Ownership and Package Boundaries

Choose the narrowest correct owner for new code.

### `packages/ui`

Put a component in `@ryanmeetup/ui` when it is presentation-focused,
brand-consistent, and useful in more than one app or feature. Examples include
buttons, cards, typography, fields, pills, icon controls, feedback states,
disclosures, section headers, social-link grids, logo treatments, and stat
cards.

Shared UI components must:

- accept content and behavior through props rather than importing app data;
- avoid app aliases such as `@/`;
- avoid imports from an app's `lib`, `hooks`, `actions`, or `components`;
- expose reusable prop types when consumers may need them;
- support `className` when composition reasonably requires it;
- use semantic HTML and preserve native element attributes where practical;
- include dark-mode, focus, disabled, and responsive behavior as applicable;
- be exported from `packages/ui/src/index.ts`.

Do not put CMS queries, route tables, analytics placement logic, EmailJS
configuration, or Ryan Meetup-only workflows in `packages/ui`.

### Feature packages

Use a feature package when code is shared but carries domain behavior:

- contact forms and submission behavior belong in `@ryanmeetup/contact`;
- sponsor-specific presentation and behavior belong in
  `@ryanmeetup/sponsors`;
- framework-agnostic conversion and validation helpers belong in
  `@ryanmeetup/utils`.

Feature packages may depend on `@ryanmeetup/ui`. `@ryanmeetup/ui` must not
depend on a feature package or an app.

### App-local code

Keep code app-local when it depends on that app's routes, CMS shape, page
composition, copy, analytics, or unique workflow. Navigation shells, page
sections, Contentful adapters, and route-specific orchestration usually remain
inside the app.

If two apps contain near-identical local implementations, consolidate the
shared primitive or behavior first. Do not maintain copies that differ only by
small props or copy.

## Imports

- Import shared ownership directly from its package, for example
  `@ryanmeetup/ui`, `@ryanmeetup/contact`, or `@ryanmeetup/utils`.
- Use `@/` only for files owned by the current app.
- Do not create app-local barrels that re-export an entire shared package. Such
  barrels hide ownership and encourage accidental coupling.
- Avoid deep imports into another package's `src` directory. Use its public
  export surface.
- Use `import type` for type-only dependencies.
- Keep package manifests accurate. A package must declare every external
  runtime dependency it imports.

## Shared Package Integration

When an app consumes a source-based workspace package:

- add the package to the app's dependencies;
- include it in `transpilePackages` when Next.js requires transpilation;
- add the package source to the app's Tailwind `@source` directives when it
  contains utility classes;
- ensure both Ryan Meetup and RyanCon receive the same change when they consume
  the package;
- verify the package does not rely on an app's global CSS beyond the shared
  brand theme.

Current shared Tailwind sources include `packages/ui/src`,
`packages/contact/src`, and `packages/sponsors/src`.

## Design Language

Use `@ryanmeetup/brand/theme.css` and existing shared components before adding
new styling conventions.

### Typography

- Use the shared `Heading`, `Text`, and `Kicker` components for their intended
  roles.
- Cooper is the display face. Use it for intentional headings, not body copy.
- Prefer clear sentence-case body copy and short uppercase metadata labels.
- Metadata commonly uses `text-xs font-semibold uppercase` with generous
  tracking.
- Avoid adding arbitrary font families or duplicating font assets in apps.

### Color and surfaces

- Use opacity-based black/white neutrals and always consider light and dark
  themes together.
- Default borders are subtle: `border-black/10 dark:border-white/10`.
- Secondary text should remain readable, normally around
  `text-black/70 dark:text-white/70`; do not reduce contrast merely for visual
  subtlety.
- Prefer shared `Card`, `Button`, `Pill`, and field variants over
  repeating long class strings.
- Reserve vivid colors for status, validation, or a deliberate campaign
  accent.

### Spacing and shape

- Prefer established gaps and spacing such as `gap-2`, `gap-4`, `gap-6`,
  `space-y-6`, and `space-y-12`.
- Cards generally use rounded corners, subtle borders, translucent surfaces,
  and restrained shadows.
- Use hover lift sparingly and consistently. Interactive elements should not
  shift far enough to disturb surrounding layout.
- When two desktop columns have unequal content, balance them through alignment
  and meaningful grouping before adding filler copy.

## Responsive Behavior

Design mobile-first, then add complexity only when the available width supports
it.

Tailwind's standard breakpoints are the shared vocabulary:

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

Rules:

- Do not make a component dense merely because a breakpoint was reached.
- A standalone action button must span the available width on mobile and may
  return to its intrinsic width at `sm` or above. Button groups may use a
  different mobile layout when the relationship between their actions remains
  clear.
- Stagger nested responsive layouts. A two-column page and a two-column form
  should not both activate at the same breakpoint if that squeezes fields.
- Contact-style major page columns remain stacked below `xl`; dense form grids
  should wait until `2xl` when their card is inside another column.
- Compact, scannable controls such as icon grids may remain compact at every
  breakpoint when verbose lists add no value.
- Prevent label wrapping and clipped input values at intermediate desktop
  widths, not only mobile widths.
- Test at the boundary widths, especially 1024, 1280, and 1536 pixels.

## Images

- Use `next/image` for optimized app imagery unless there is a concrete reason
  not to.
- Every image needs meaningful `alt` text; decorative imagery should use an
  empty alt value.
- A `fill` image must have a positioned containing block, normally `relative`,
  with an explicit height or aspect ratio.
- Use Tailwind's built-in aspect syntax such as `aspect-[2/1]` or
  `aspect-[3/4]`.
- Do not use legacy `aspect-w-*` or `aspect-h-*` classes. The old aspect-ratio
  plugin is not part of the current Tailwind setup.
- Add new remote hosts to the relevant app's Next image configuration rather
  than bypassing image optimization.
- Include an appropriate `sizes` value for responsive `fill` images.

## Next.js and React

- Prefer Server Components by default. Add `"use client"` only when hooks,
  browser APIs, or interactive libraries require it.
- Keep user-facing query parameters human readable and shareable. Prefer stable
  names, slugs, or descriptive enum values over database IDs; resolve those
  values to internal IDs at the data boundary. Use an ID only when no reliable
  readable identifier exists or when the parameter is intentionally internal.
- Generate public links with readable query values from the outset; do not rely
  on a client-side normalization effect to replace an ID after navigation.
  When practical, continue accepting legacy ID values and replace them with the
  readable form so existing bookmarks remain useful. Internal API request query
  strings may use IDs when they are not browser navigation or shareable state.
- In current Next.js route pages, dynamic APIs such as `searchParams` may be
  promises. Type and `await` them before reading their properties.
- Keep data fetching and secrets server-side. Only expose intentionally public
  environment variables with the `NEXT_PUBLIC_` prefix.
- Use `next/link` for navigation and distinguish internal navigation from
  external links. External links opened in a new tab need safe `rel` values.
- Avoid index keys when a stable content identifier exists.
- Do not suppress hydration, type, or lint errors without documenting the
  concrete reason next to the suppression.

## Forms and Feedback

- Every editable form field must communicate whether it is required. Required
  fields must use the shared component's `required` prop (or native `required`
  semantics) so the visible red asterisk, ARIA state, and browser behavior
  agree. Optional fields must not display an `(optional)` suffix or any other
  optional marker. Apply this convention to create and edit forms, not search,
  filter, display-only, disabled, or action controls.
- A field with a default value is still required when the user must submit one
  of its allowed values. Keep UI required state aligned with client validation,
  API schemas, and database constraints; never mark a field optional when the
  save path rejects an empty value.

- For user-entered web URLs, accept bare domains and paths such as
  `example.com/resource`; use the shared `ensureHttpUrlScheme` or
  `normalizeHttpUrl` helpers from `@ryanmeetup/utils` so HTTPS is assumed when
  the scheme is omitted. Reuse these helpers in both the UI and API validation
  instead of adding app-local URL normalization.

- Use the shared field components so labels, required markers, focus rings,
  placeholders, errors, and theme behavior remain consistent.
- Every single-choice control must be `DropdownSelect`. A native `<select>`
  cannot be styled consistently across platforms and ignores the theme, so the
  native `Select` primitive was removed from `packages/ui`; do not reintroduce
  one, in an app or in the package. Use `variant="field"` for a labelled form
  field and `variant="compact"` for a toolbar or filter control. Reach for
  `MultiSelect` when more than one value may be chosen.
- All search inputs must use the shared debounced search behavior established by
  the task board. Update the input value immediately, debounce filtering and URL
  state, show a loading spinner in the input while the query is pending, and
  expose the same pending state over the main results area with `aria-busy`, a
  visible loading status, and temporarily disabled/dimmed stale results.
- Labels must remain visible; placeholders supplement labels and do not replace
  them.
- Write placeholders and helper copy in the Ryan voice when appropriate, but
  keep the requested action clear.
- Disable submission only for a clear reason and expose loading, success, and
  error states accessibly.
- Do not allow long placeholder or entered values to be visibly clipped because
  a responsive grid activated too early.

## Accessibility

- All interactive elements must be keyboard reachable and have visible focus
  treatment.
- Icon-only buttons and links require an accessible name.
- Use real buttons for actions and links for navigation.
- Preserve Headless UI semantics when wrapping dialogs, disclosures, popovers,
  and transitions.
- Honor disabled states with both behavior and appropriate ARIA where needed.
- Do not communicate status or selection by color alone.
- Respect reduced-motion preferences for any substantial animation.

## Copy and Content

- Keep copy concise, warm, and lightly playful. Ryan jokes should support the
  message rather than obscure it.
- Prefer specific guidance over generic filler. For example, name relevant
  contact topics rather than saying only "How can we help?"
- Do not invent event facts, sponsor claims, statistics, or organizational
  policies.
- Keep shared components free of app-specific copy unless the component itself
  is intentionally Ryan-branded and the copy is stable across consumers.

## Validation

Validate in proportion to the change, from the affected workspace.

## Commits and Changelog

- Break completed work into several small, reviewable commits instead of one
  catch-all commit. Group files that implement the same behavior or concern,
  and keep unrelated features, fixes, refactors, tests, and documentation in
  separate commits.
- Use Conventional Commits for every commit message, including an appropriate
  scope when it clarifies ownership, for example `feat(tasks): add activity
  filters` or `fix(ui): keep breadcrumb labels readable`.
- Keep each commit internally coherent: include directly related tests and
  documentation with the behavior they cover, and avoid splitting a change in
  a way that leaves an intermediate commit knowingly broken.
- When user-visible Tasks behavior changes, review the current release entry in
  `apps/tasks/lib/changelog.ts` and update it when the change is meaningful to
  users. Do not add implementation-only details or duplicate existing release
  notes.

### Supabase database changes

**`apps/tasks/supabase/migrations` is the source of truth, and every schema
change is a committed migration file.** Two instances run this app —
`tasks.ryanmeetup.com` and `projects.ryanle.dev` — on separate Supabase
projects in separate accounts. A change applied to one database and not written
down cannot reach the other, and the second instance simply comes up missing
it.

Earlier guidance here said the opposite: write the SQL in a temporary file,
apply it directly to the linked project, and delete the file. That is how nine
objects behind workspace provisioning and project visibility ended up in the
Ryan Meetup database and nowhere else, which broke the second instance's
deploys. Do not apply schema changes by hand, and never delete an applied
migration file.

For a database change:

1. Write a new file in `apps/tasks/supabase/migrations` with a timestamp after
   the latest one. A new `public` table needs explicit `grant` statements in
   that same file; Supabase no longer grants new tables to the Data API roles.
   See "New tables grant nothing" in `apps/tasks/docs/DATABASE.md`.
2. `supabase db reset` to apply it from empty, then
   `supabase db diff --linked --schema public` to see exactly what it changes
   relative to the linked project.
3. Run the relevant unit and route tests. The Playwright suite runs against a
   stub and verifies nothing about the schema.
4. Commit the file with the code that depends on it.
5. Apply the migration to both instances using their supported paths:
   - **RMT** (`lvfaartgcpphuokoswcm`): this machine has CLI access. Run
     `supabase db push` yourself and verify the remote migration state.
   - **PRD** (`vjsnobmfsfrsnwukfaoq`): Ryan does not have CLI access. Never
     hand him `supabase link`, `supabase db push`, or other CLI instructions
     for PRD. Give him the exact, complete SQL block to paste into the PRD
     Supabase dashboard's **SQL Editor**, followed by a concrete verification
     query and its expected result. Source that SQL from the committed
     migration, make it safe to re-run where practical, and state explicitly
     that it must be run against PRD rather than RMT.

Code that reads a table added by a migration that may not be applied yet can
tolerate a missing relation through `isMissingRelation` in
`lib/server/supabase-errors.ts` and fall back to defaults, so the deploy and
the migration can land in either order. That tolerance is only ever for a
missing table — every other database failure must propagate.

`apps/tasks/scripts/check-database-contract.mjs` runs before a production build
and fails the deploy when the configured database is reachable but missing the
contract. Fix the database rather than reaching for
`SKIP_DATABASE_CONTRACT_CHECK=1`.

See `apps/tasks/docs/DATABASE.md` for the schema baseline and verification
detail, and `apps/tasks/docs/MULTI_INSTANCE.md` for everything outside the
database — including the rule that an instance never borrows the other's
Supabase credentials, not even as a temporary diagnostic.

Minimum expectations:

1. Run ESLint on changed TypeScript/TSX files.
2. Run `git diff --check`.
3. Run relevant unit or Playwright tests when behavior changes.
4. Run the affected app build for package, configuration, routing, or
   production-rendering changes.
5. Visually inspect responsive or layout changes at mobile and relevant desktop
   boundary widths when browser tooling is available.

Useful commands:

```sh
npm run build:ryanmeetup
npm run build:ryancon
npm run build
npm run lint --workspace=@ryanmeetup/ryanmeetup
npm run lint --workspace=@ryanmeetup/ryancon
```

If a check fails for an unrelated existing issue or restricted network access,
report the exact blocker. Do not claim the check passed.

## Change Checklist

Before handing off a change, confirm:

- no existing shared component or utility was needlessly duplicated;
- ownership is correct: UI, feature package, utility package, or app;
- new shared exports, dependencies, Tailwind sources, and transpilation config
  are complete;
- light mode, dark mode, mobile, and intermediate desktop widths remain usable;
- `next/image fill` containers are positioned and sized;
- interactive controls have semantics, labels, focus, and disabled behavior;
- app-specific data and routing did not leak into `packages/ui`;
- lint, formatting/diff, tests, and builds were run as appropriate;
- unrelated user changes remain untouched.
