# Tasks App Organization Backlog

This document tracks the remaining structural work in `apps/tasks`. The goal is
not to make every file small. The goal is to give each concern one clear owner,
keep route and page components focused on orchestration, and prevent category,
project, task, and access behavior from drifting into parallel implementations.

The order below reflects architectural value and risk. Complete one cohesive
boundary at a time and keep the tasks workspace passing lint, TypeScript, tests,
and `git diff --check` after every boundary.

## 1. Finish the shared resource-management boundary

Current hotspots:

- `components/categories/CategoriesModal.tsx`
- `components/projects/ProjectsModal.tsx`
- `components/resources/ResourceAttachments.tsx`
- `lib/resources/resource-management.ts`
- `lib/server/resource-attachments-route.ts`

Remaining work:

- Extract the repeated create/edit resource form composition into neutral,
  focused fields. Name, description, owners, links, and attachments should have
  one composition API, while category color/tags and project favorites remain
  domain-specific slots or siblings.
- Extract category and project modal state transitions into separate hooks or
  controllers. The modal components should primarily compose list, create, and
  edit views rather than own API calls, optimistic updates, filtering, and every
  draft field in one file.
- Split `ResourceAttachments` into an attachment list, note editor, file upload
  control, and a controller hook. Keep upload/fetch/delete behavior out of the
  449-line presentation component.
- Split the shared server attachment handler into request parsing/validation,
  storage operations, and database persistence helpers. Preserve the two thin
  route entry points.
- Rename remaining project-shaped shared types such as `ProjectLink` and the
  attachment union when doing so can be accomplished without a compatibility
  break. Links are now shared by projects and categories.
- Add focused tests for resource sorting/filtering, attachment draft behavior,
  and attachment request validation before materially changing those paths.

Completion criteria:

- Categories and projects reuse common resource fields and attachment behavior.
- Their modal files contain domain orchestration and copy, not duplicated field
  structures or low-level request mechanics.
- The resources directory owns all UI that accepts either resource kind.

## 2. Decompose `TaskApp` into board and editor controllers

Current hotspot: `components/tasks/TaskApp.tsx` (about 1,200 lines).

Remaining work:

- Extract task create/edit draft lifecycle, autosave, validation, and submission
  into a `useTaskEditorController` hook. `TaskEditor` should receive a coherent
  controller instead of a large collection of unrelated state setters.
- Extract board drag state and move coordination into a `useTaskBoardDrag` hook.
  `TaskBoardCard` already owns DOM drag details; the hook should own dragged ID,
  target, column hover, cleanup, and mutation coordination.
- Move task-to-card related-data resolution into a memoized selector or board
  view model. Avoid filtering all subtasks separately for every card render.
- Extract board column composition into a `TaskBoardView` component. `TaskApp`
  should choose board versus list, not render the entire board structure.
- Group query/filter/pagination inputs into named controller objects before
  passing them downward. Avoid broad bags that expose unrelated setters.
- Move `editDraft` into the task draft/factory module so draft construction has
  one owner.

Completion criteria:

- `TaskApp` reads as workspace orchestration: load data, select view, coordinate
  mutations, and compose dialogs.
- Board behavior, editor behavior, and filter/query behavior can be tested in
  isolation.
- No per-card linear scans remain for relations that can be indexed once.

## 3. Access-domain decomposition — completed

Access mutations now live in `useAccessManagement` and the server operation
dispatcher/services. Membership indexing and the shared inheritance model are
tested domain helpers. Group membership has its own panel, and the effective
project/category/page explanation has its own component and derivation module.
The obsolete direct-user project grant model and its compatibility permission
selectors have been removed.

## 4. Separate search data, state, and results presentation

Current hotspot: `components/navigation/TaskSearch.tsx` (about 630 lines).

Remaining work:

- Extract search result normalization, ranking, grouping, and href generation
  into framework-light helpers with unit tests.
- Extract keyboard active-index and open/close behavior into a hook.
- Split the result list and result item presentation from the header search
  trigger/input.
- Reuse the established debounced search contract: immediate input state,
  deferred query state, visible spinner, `aria-busy`, and stale-result disabling.
- Check whether task search and activity/notes search share query-state or result
  status primitives without forcing different result domains together.

Completion criteria:

- Search ranking and navigation targets are testable without rendering React.
- The component primarily coordinates the input, popover/dialog, and results.

## 5. Split activity and notes page clients

Current hotspots:

- `components/activity/ActivityPageClient.tsx`
- `components/notes/NotesPageClient.tsx`

Remaining work:

- Move activity description generation, actor/resource resolution, and date
  grouping into `lib/activity/activity-presentation.ts` with tests.
- Extract activity result rows/groups and the filter/query controller.
- Move `NoteRow` out of `NotesPageClient` and separate note draft/autosave state
  from collection filtering and pagination.
- Consolidate generic response parsing with the mutation client rather than
  retaining a notes-local `responseJson` helper.
- Keep note-to-task conversion in a notes domain service; do not put it in a
  generic UI component.

Completion criteria:

- Page clients own layout and orchestration only.
- Formatting, filtering, autosave, and conversion behavior have isolated tests.

## 6. Clarify task detail and editor ownership

Current hotspots:

- `components/tasks/TaskDetails.tsx`
- `components/tasks/TaskEditor.tsx`
- `components/tasks/NewTaskDetails.tsx`
- `components/tasks/TaskPageClient.tsx`

Remaining work:

- Extract remaining task-details request and mutation orchestration into a
  controller hook; the checklist, comments, activity, and attachments panels
  are already separate.
- Identify fields shared by task create, edit, and quick-create and give those
  fields one component/API. Preserve workflow-specific layout and copy.
- Consolidate due/start date and reminder normalization in one task scheduling
  module used by both UI drafts and API validation.
- Reduce duplicated task relation lookup between `TaskPageClient`, `TaskApp`,
  and `TaskDetails` with explicit selectors rather than passing full
  `WorkspaceData` everywhere.
- Keep server-only task loading out of client component modules.

Completion criteria:

- Task field definitions and schedule normalization do not drift across create
  and edit workflows.
- Detail components receive the narrow data and actions they use.

## 7. Split workspace loading and task API services

Current hotspots:

- `hooks/useWorkspaceData.ts`
- `app/api/tasks/route.ts`
- `lib/server/workspace-loader.ts`
- `lib/api-schema/index.ts`

Remaining work:

- Separate realtime subscription setup from workspace state reconciliation in
  `useWorkspaceData`.
- Move event-to-state reducers into pure helpers and test insert/update/delete
  reconciliation independently.
- Split task API list-query construction, create, update, and delete into server
  service modules. The route should authorize, validate, dispatch, and format
  responses.
- Break `api-schemas.ts` into domain schema modules when the split improves
  discoverability (`task`, `resource`, `access`, and profile schemas), with a
  deliberate public export surface.
- Audit database selection strings and row adapters for duplication between
  workspace loading and task routes; centralize only stable database shapes.

Completion criteria:

- Route files are thin HTTP boundaries.
- Realtime reconciliation and database mapping are pure/tested where possible.
- Server modules do not leak into client bundles.

## 8. Break out remaining large presentation sections

Lower-priority candidates:

- Dashboard page sections can move beside `DashboardWidgets`; keep dashboard
  data derivation centralized rather than scattering it across widgets.
- `TasksSidebar` and `TaskHeaderActions` can share navigation item/view-model
  helpers, favorite rendering, and access-preview awareness.
- `TaskAdministration` should split status list/reorder presentation from modal
  state and status mutations.
- `ProfileForm` should separate avatar upload, preference controls, and profile
  mutation state.
- `TaskListView` should extract row and responsive-card presentation if both
  layouts continue to repeat task metadata rendering.

Do these only after the higher-value controller and domain boundaries above.
Small presentational extraction should improve naming or reuse, not merely move
lines between files.

## 9. Normalize types and module exports

Remaining work:

- Split `lib/types.ts` by stable domain once import churn can be handled in one
  pass: workspace/profile, tasks, resources, and activity. Keep a temporary
  compatibility export only during migration.
- Prefer domain-owned types such as `access-types.ts` over component-local
  copies.
- Audit component `index.ts` files. Keep small intentional public surfaces;
  remove exports that are only used inside their feature directory.
- Avoid deep imports across feature directories. A cross-feature component
  should move to the correct neutral owner rather than being re-exported from a
  misleading feature.
- Continue using `import type` and ensure client modules never pull server code
  through a barrel.

Completion criteria:

- A file's directory reliably communicates its ownership.
- Public exports are intentional, and domain types no longer live beside UI
  merely because that was their first consumer.

## 10. Expand structural regression coverage

Add tests alongside each extraction instead of creating a final testing phase.
The most valuable missing coverage is:

- resource attachment validation and cleanup failures;
- resource create/edit normalization;
- access effective-permission derivation;
- task board relation selectors and drag-state cleanup;
- realtime workspace reconciliation;
- task search normalization/ranking;
- note autosave and task conversion;
- activity description/date grouping;
- task scheduling normalization.

Use component tests only where semantics or interaction require rendering.
Prefer unit tests for selectors, normalization, reducers, and server services.

## Explicit non-goals

- Do not create abstractions solely to reduce line counts.
- Do not move app-specific task/access behavior into `@ryanmeetup/ui`.
- Do not combine category and project rules that only happen to use similar UI.
- Do not create broad `utils.ts`, `helpers.ts`, or catch-all hooks; name modules
  after the domain behavior they own.
- Do not replace narrow props with full `WorkspaceData` unless the consumer
  genuinely coordinates the workspace.
- Do not perform a repository-wide type or naming rewrite alongside behavioral
  work.

## Validation for every pass

At minimum, run:

```sh
npm run lint --workspace=@ryanmeetup/tasks -- --no-cache
npx tsc --noEmit -p apps/tasks/tsconfig.json
npm test --workspace=@ryanmeetup/tasks
git diff --check
```

Run the tasks production build for route, server-module, package, or production
rendering changes. If the existing environment prevents the build from binding
its internal Turbopack port, report that exact blocker rather than treating the
build as passed.

The current lint baseline includes two existing internal-navigation warnings in
`components/auth/LoginForm.tsx` and `components/auth/PasswordForm.tsx`. Do not
introduce additional warnings.
