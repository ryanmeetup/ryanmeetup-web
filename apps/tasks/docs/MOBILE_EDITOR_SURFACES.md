# Mobile editor surfaces

Audit date: 2026-09-03
Revised: 2026-09-04 — the Tier 1 routes are real pages, not dialogs on a route,
and which surface you get is now a profile preference rather than the viewport
alone.
Revised: 2026-11-23 — Tier 2 shipped: access group creation, both digest
editors, the note dialog, and the two read-only detail dialogs now have routes.
Status: Tier 1 and Tier 2 shipped. The open questions below are not started.

Every create/edit flow in the Tasks app was a `Modal`. On a phone the shared
dialog caps itself at `max-h-[min(42rem, 100dvh − safe-area insets)]`, pads the
body with `p-6`, and keeps a `shrink-0` header and footer. Nothing overflows —
`Modal` has always handled `dvh` sizing, safe-area insets, an internal scroll
container, and a "Scroll for more" affordance — but on a 390×844 screen with a
stacked footer and the virtual keyboard raised, the largest editors were left
with under 200px of usable form area.

The fix is not a bigger dialog. The largest editors are laid out as two columns
(`lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]` in
`components/resources/ExpandableResourceEditor.tsx`) and widen from `lg` to
`2xl` when their supporting details expand. Below `lg` that grid collapses to a
single column, so on a phone the expand gesture buys nothing and only doubles
the scroll length inside a fixed-height box.

## What shipped: the Tier 1 editors

The five heaviest editors now have dedicated routes. Contacts use those routes
at every viewport; the other four default to a dialog on a desktop.

| Editor | Route | Dialog |
| --- | --- | --- |
| Task | `/task/new`, `/task/[key]/edit` | `TaskEditor` |
| Project | `/projects/new`, `/projects/[id]/edit` | `ProjectsModal` |
| Category | `/categories/new`, `/categories/[id]/edit` | `CategoriesModal` |
| Contact | `/contacts/new`, `/contacts/[contact]/edit` | None — the route is the only surface |
| Calendar event | `/calendar/event/new`, `/calendar/event/[id]/edit` | `CalendarEventEditorModal` |

### Who chooses: `profiles.editor_surface`

The viewport is a good default and a bad rule. Someone on a large screen may
still want the whole page for a form they are going to sit inside for a while,
and someone else would rather never lose the board behind the dialog. So the
choice is a profile column, `editor_surface`, set on `/profile` under
Preferences and owned by `lib/workspace/editor-surface.ts`:

| Value | What a trigger does |
| --- | --- |
| `auto` (default) | Dialog from the `sm` breakpoint up, route below it — what shipped first |
| `modal` | Dialog at every width |
| `page` | The dedicated route at every width |

Contacts are unaffected: they have no dialog to prefer. `auto` stays the default
because it is right for anyone who has not thought about it — a dialog has the
room on a desktop and does not on a phone.

### How it works

`EditorSurface` in `components/global/` picks the surface, and it is the only
file that knows there are two. `presentation: "modal"` renders the shared
`Modal`; `presentation: "page"` renders `EditorPageSurface`. Both take the same
`formId`/`onSubmit` contract, so an editor's form body is written once and does
not know which surface it landed in.

Which of the two a person reaches is decided one step earlier, at the trigger.
`editorTriggers` in `components/global/editor-routes.ts` reads the profile's
`editor_surface` and answers which halves of the trigger pair to render; every
create and edit affordance asks it rather than reaching for a class name
directly.

The two surfaces are genuinely different screens. The first version of this work
made the page branch render `Modal`'s own chrome — a bordered card with a close
control in its corner and a sticky action bar — which is a dialog wearing a URL.
A dialog is a layer over something else, so it dims a backdrop, caps its own
height, scrolls inside a card, and offers a control whose only job is to reveal
what it covered. A route covers nothing. So `EditorPageSurface` builds a page:

- a **compact breadcrumb trail** back to the editor's list, in place of the
  dialog's close button — the trail says where you are, which a close button
  cannot;
- the same **`PageHeader`** every other workspace screen uses, with the title as
  a real `h1` and a one-line description under it;
- the form in **`Card` sections** that scroll with the document, so the browser's
  own URL-bar collapse gives the form the whole viewport;
- the **commit actions in the card**, under the fields they save, rather than
  pinned above them;
- a **column that widens with the form**. `size` is the one dialog-shaped prop
  the page branch honours, because it is really a statement about how much room
  the form needs: the editors whose supporting details open *beside* the fields
  already raise it, and `EditorPageSurface` reads it off its own scale — the
  dialog's rungs shifted one wider, since a page has no backdrop to leave room
  for. A page that dropped it kept a fixed column and crushed the two-column
  grid into the width one column needed.

`components/contacts/ContactEditor.tsx` is the reference composition. It builds
this shape directly rather than through `EditorSurface`, because it is the one
editor whose action row moves between sections — with an existing contact the
actions sit with the fields most often edited, above a People list that can run
long; on a new contact everything is new, so they go last. Keep the two in step
by eye: same trail, same header, same cards.

Contacts use their route at every viewport. The other four editors keep the
mobile-page/desktop-dialog split unless the reader's profile pins a surface.

Three rules keep the dual-surface editors from diverging:

- **The form body never knows which surface it is in.** If a field needs to
  know, that is a layout concern and belongs in the surface, not the field.
- **The breakpoint is CSS, never JavaScript.** On `auto` a trigger renders an
  anchor that is visible below `sm` and a button that is visible from `sm` up,
  both always mounted. There is no `matchMedia` in the routing decision, so
  there is no hydration mismatch and no flash of the wrong surface. A pinned
  preference has no breakpoint left to honour — the answer came from the profile
  the server rendered — so `editorTriggers` drops the losing half from the tree
  instead of hiding it. That is not just cheaper: a plain `hidden` would not
  even work, for the reason `surfaceTriggerClassNames` in `@ryanmeetup/ui` documents. The
  store's review form uses the same pair to open `/products/[handle]/review` and
  `/reviews/mine/[reviewId]/edit` on a phone.
- **The trail is canonical; the return is not.** `parents` names the screens the
  editor sits under — always the list itself, plus the record's own page where
  there is one. Where cancelling *returns* to is a separate question answered by
  `?from=` or `router.back()`, because the author may have arrived from the
  calendar or a project.

### Why the trigger pairs live where they do

The create affordances funnel through very few files even though ~9 page
clients pass `onCreateCategory`/`onCreateProject` down. `TasksSidebar` owns the
sidebar's create buttons and `WorkspacePageShell` owns the global new-task
button, so the mobile link/desktop button pair is written once in each rather
than at every call site. Per-row edit affordances are the exception and are
paired individually on the management cards.

## Tier 2: shipped

The same route/dialog pair, through the same `editorTriggers`, for the next
tier of dialogs that were too big for a phone.

| Surface | Route | Dialog |
| --- | --- | --- |
| New tier or team | `/admin/access/new?kind=tier\|team` | `CreateAccessGroupModal` |
| Digest cadence | `/admin/usage/digest/cadence` | `DigestCadenceModal` |
| Digest structure | `/admin/usage/digest/structure` | `DigestStructureModal` |
| Note | `/notes/[id]`, `/notes/[id]/edit` | `NoteModal` |
| Email detail | `/admin/usage/emails/[id]` | `EmailDetailModal` |
| Google Calendar event | `/calendar/google/[id]` | `GoogleEventModal` |

Notes on the less obvious ones:

- **Access groups.** Editing a group was already its own page,
  `/admin/access/[slug]`; only creation was a dialog. The create route shares
  that segment, so `isReservedAccessGroupName` refuses any group whose slug
  would be `new`, in the form and in the API schema.
- **Digest settings** stay two editors with two saves on their routes as well.
  The routes don't merge them into one settings page.
- **Notes** had no route at all. Notes have no readable identifier (titles are
  optional and repeat), so the route names one by ID, like
  `/categories/[id]/edit`. Reading and editing are one page; switching modes
  replaces the address so a reload keeps the mode. Archive, convert, and
  delete stay in the list's row menu.
- **The read-only pages** (email detail, Google event) render through
  `EditorPageSurface` without a form: the trail, the header, the content in a
  card, and the actions after it. They drop the dialog's Close button, since
  the trail leads back. The email page is loaded on the server instead of
  fetched after opening; the Google event comes from
  `getGoogleCalendarEvent`, which shares its shaping with the month listing.
  Anyone who can't see the shared calendar gets the same 404 as a missing
  event.

Still worth doing on its own terms: `DigestStructureModal` reorders sections
with small `IconButton` arrows, which are small targets for a thumb whatever
surface they sit in.

## Deliberately left as modals

These are the right size for a dialog and should stay one. Listed so the next
pass does not re-audit them:

`StatusCreateModal`, `StatusReasonDialog`, `ProfileAccessModal`, `TeamDialogs`,
the four admin settings modals (`Banner`, `Email`, `Identity`, `LinkPreview`),
`ResourceAttachmentsPreview` (an image viewer, and correctly the one dialog
that opts into `dismissOnOutsideClick`), the two `CalendarPageClient`
day-agenda list dialogs, and every `ConfirmationDialog`.

The admin settings modals are small specifically because that form was split
per concern instead of being kept as one page-wide save. Do not undo that by
recombining them onto a page.

## Open questions

- **Draft continuity across the surface switch.** `useTaskEditorController`
  autosaves a task draft to local storage, so a task survives the jump from a
  half-filled dialog to the route. No other editor has an equivalent. If a
  future change lets a viewport change swap surfaces mid-edit, every Tier 1
  editor needs that autosave, not just tasks.
- **One breakpoint, three definitions.** `TaskWorkspaceHeader` and
  `NoteComments` use 768px, `LatestChangelogCard` uses 1024px, and
  `ContactsPageClient` uses both 768px and 1536px — all through separate
  `matchMedia` calls. The mobile editor routes deliberately avoid JavaScript
  entirely, so they did not force this cleanup, but a shared hook is still owed
  if any of that logic grows.
- **`GoogleCalendarControls` opens a dialog from a dialog.** Not a size problem,
  but stacked dialogs on a phone are disorienting. Worth revisiting if the
  calendar integration grows.
