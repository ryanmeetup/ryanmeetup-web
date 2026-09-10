---
version: "0.7"
slug: v7-faster-follow-through
author: Ryan Le
date: "2026-09-04"
dateLabel: August 28 – September 4, 2026
title: Transactional writes, multiple assignees, and read-only MCP access
summary: Resource changes and their history now succeed or fail together in one Postgres transaction, tasks can hold a crew instead of one name, whole pages can be locked to access groups, and a trusted assistant can read the workspace without touching it.
overview:
  - Every resource change and its activity row in one transaction
  - Project homes for progress, attention, dates, context, and recent work
  - Multiple assignees per task, backed by the join table rather than a column
  - Statuses that require a written reason before work enters them
  - Notes, Contacts, and Calendar lockable to selected access groups
  - Read-only MCP access for Claude Desktop
  - Server-written comments, attachments, and activity without a refresh
  - Full-page editors on phones, or on every screen if you prefer them
  - Multiple contact methods per person
  - CI gated on types, unit coverage, and end-to-end tests
---

## New

### Projects get a home of their own

Every project now opens to a readable overview instead of dropping straight
into a filtered board. The page brings together open, overdue, upcoming, and
completed work; calls out the tasks that need attention; shows progress across
the workspace's own statuses; and keeps owners, dates, links, notes, files, and
recent task activity close. The board remains one click away, and new tasks
started from the overview already know which project they belong to. Each
summary measure opens the board with its matching project, status, and due-date
filters already applied. A board shortcut beside each sidebar project keeps the
old straight-to-work path just as quick. On wider screens, the project team,
upcoming dates, and context stay in view while the main overview scrolls; the
team includes project owners plus everyone assigned work in that project.
Project context now opens in its own focused editor, where saved links collapse
into compact rows and use each page's social preview image when one is available.
New project timelines begin on the day they are created by default, while still
allowing an earlier start date when the work was already underway.

### Duplicate the work, not the setup

Existing tasks can be duplicated from either the board editor or the task page. The new task carries the original fields into a fresh draft, ready to adjust before saving, while the original stays untouched.

### Paste a checklist all at once

Paste a plain-text or Markdown list into the checklist field and Tasks turns every line into its own item in one save. Bullets, numbering, and task boxes are cleaned up automatically, and checked task boxes stay checked. The whole paste writes one summary activity row rather than one row per line.

### Status changes with their reason attached

Owners can mark a status as requiring an explanation. Moving a task into one of those statuses asks why and writes the answer as a task comment in the same transaction as the status change, so the decision and its context cannot drift apart. **Will Not Do** starts with this requirement, and new statuses can be created directly from the Statuses page header.

### Read-only access for trusted assistants

Deployments configured for it can offer a read-only MCP connection for Claude Desktop. A trusted assistant can inspect tasks, projects, categories, notes, contacts, calendars, activity, and workspace metrics with no ability to create, edit, delete, or upload anything.

### Lock a whole page to the people who need it

Notes, Contacts, and the Calendar can each be restricted to selected access groups from **Admin → Access → Page access**. A restricted page disappears from the sidebar for everyone who cannot open it, and its content — notes and their comments, the contact directory, calendar events and the synced Google feed — is refused at the database, not merely hidden. Pages stay open to everyone until an owner restricts them. App owners keep every page; workspace-wide tiers can be selected explicitly like any other group.

## Improved

### Access with a reason, not a riddle

App ownership, organizational tiers, teams, and resource visibility now have distinct jobs on **Admin → Access**. An owner can promote a successor and replace one person's role, required tier, and optional teams in a single save; the last owner cannot be demoted. The default tier for new members is labeled and can be changed deliberately, and each group page lists the projects, categories, pages, and Google Calendar feed it opens — including whether access is direct, inherited, workspace-wide, or simply open to everyone.

### Big editors get room to breathe on phones

Creating or editing a task, project, category, contact, or calendar event uses a full mobile page with reachable actions and returns you to the exact filtered view you came from. Contacts use their dedicated pages on desktop too, while the other editors keep their familiar desktop dialogs.

### Choose where forms open

**Profile → Preferences** now has **Create and edit forms**. Leave it on _Match the screen_ and nothing changes: a dialog on a desktop, a full page on a phone. Choose _Always a dialog_ to keep the board or list behind every form at any size, or _Always a full page_ to give every form the whole screen. The setting follows your account rather than the browser you happen to be using.

### Open the calendar on what matters

**Profile → Preferences** now lets each person choose any combination of what
the Calendar shows first: task deadlines, time away, important dates, and
Google Calendar. The choice belongs to the profile in that deployment, so RMT
and PRD can open differently — including everything except Google — while the
multi-select Show menu remains available for quick changes.

### Contact links you can read

Editing a contact now happens at an address that names it — `/contacts/the-lantern-room/edit` — with nothing else appended. Older links built from the contact's id keep working, and two contacts sharing a display name keep theirs. Leaving the editor returns you to the directory exactly as you left it, search and scroll position included.

### Tasks can have a crew

Assign a task to several teammates without replacing the people already on it. My Tasks, dashboard counts, search, and weekday digests all recognize shared assignments.

### Every way to reach someone

Each person on a contact can have multiple email addresses and phone numbers, with labels such as Personal, Work cell, or Office. The person editor groups those details into compact lists with clear counts and quick add and remove controls. Every saved method stays searchable and appears as its own email or call link in the contact directory.

### Task cards with less label clutter

Task cards keep each category together as one colored badge without piling on its selected tags. Hovering a category reveals those tags, and the task page shows their names beneath the category they refine, so the detail stays available without turning every categorization into another competing badge.

### Changes appear while they are still fresh

Comments, checklist updates, attachments, and activity written by the server appear as soon as the save finishes instead of waiting for a refresh. Project and category attachment changes refresh across open views and connected teammates.

Changing task filters, searches, sorting, pages, or views while results load keeps the newest request, so a slower earlier response cannot replace the choice you just made.

Signing in opens the workspace on the first try. It used to flicker between the sign-in screen and a page holding nothing but the footer, and only a full page reload settled it.

### Activity tells the fuller story

Activity now covers access groups, visibility grants, teammates, statuses, digest settings and runs, workspace identity and banner changes, Google Calendar connections, and email administration. Task updates show field-level changes, and status explanations appear alongside the change that prompted them.

### Safer files and richer text

Contact image uploads save together with their contact, and replacing, removing, or deleting an uploaded image also cleans up the old file in storage. Rich-text fields preserve intentional spacing and show Markdown headings while editing. Modals require a deliberate close action, protecting longer edits from an accidental backdrop click. Saved drafts keep their checklist, linked attachments, and opening comment.

### One identity across the workspace

A workspace uses one instance name for page titles, digest emails, link previews, the sidebar wordmark, and the footer. Owners write the workspace notice under **Banner** in Settings, including an optional link and label. Updating the message brings the banner back for teammates who dismissed an older notice, while an untouched setting continues to use the deployment default.

### Work you decided against is finished too

A status now says how work ends: open, delivered, or declined. **Will Not Do**
is a declined ending, so a task you turn down closes the same way finished work
does. It leaves your open counts, stops arriving in the weekday digest, comes
off the calendar, stops showing up as overdue on a project, and archives after
two weeks. It is never counted as something the team completed, and a project's
progress bar no longer treats an abandoned task as delivered. Owners set the
ending for any status under **Statuses** in the admin section.

### The archive reads like a record

Active and Archived are now a switch beside the board and list controls, rather
than a setting inside the filters panel. Archived work opens as a list grouped
by the month it closed, showing when each task ended instead of when it had been
due, newest first. The board is no longer offered there: only a status that
closes work can hold an archived task, so the old archived board was a row of
permanently empty columns.

### Search reaches into the archive

Searching now finds archived work as well, listed at the very bottom under an
**Archived tasks** heading so it never competes with what is still live. Each
archived result shows when it closed rather than when it had been due. Typing
the key of an archived task finds it, which it previously did not, even though
opening that task's link had always worked.

### A calmer canvas

The workspace sits on a subtle paper texture with solid task columns that stay readable over it. The board keeps its horizontal scroller against the bottom edge, and the latest-release card starts collapsed on smaller screens.

Collapsed board columns now keep their description and search controls while hiding the task stack instead of leaving an empty full-height lane. Expand one and its tasks slide back into view; pick up a task and collapsed columns temporarily open into large, clearly labeled drop targets, keeping moves easy without the dead space.
Starting a search from a collapsed column slides it open automatically so the matching tasks appear without an extra click.
Column headers stay in place above their own taller scrolling task lists, while the page canvas supplies the breathing room outside the rounded columns.
The board fills the available screen height with equal outside spacing above and below, adapts when the window resizes, and omits the footer. Page scrolling stops at that padded position while each task list continues scrolling; scrolling back up reveals the heading and filters.
Task lists now run flush to each column's rounded bottom edge, without a separate divider or fixed bottom strip.

Form labels now use the same clear sentence-case heading treatment throughout task, note, resource, calendar, profile, and admin editors.

Buttons that sit beside fields now match the input height with tighter typography and padding, while standalone quick actions use the same compact sizing as save and cancel controls.

On phones, calendar navigation keeps the month centered, places filters and Today on one tidy row, and leaves the agenda to carry the detail instead of squeezing in the desktop rail. The navigation drawer also closes as soon as a destination opens.

Phone-sized form fields now stay aligned and use a Safari-safe text size, so focusing an input no longer zooms the page and leaves the workspace magnified afterward. The page also stops at the footer instead of scrolling into Safari's empty post-keyboard space.

New contacts now finish with Create and Cancel after the People section, encouraging a complete contact record before it is saved. Existing-contact actions stay beside the contact details for quicker edits.

Projects lead with active work, follow their lifecycle order, and default to Discovery. Project and category visibility controls stay with their own editors instead of appearing as a second set of controls on the Access page.

## Under the hood

### Writes that cannot half-finish

Categories, projects, contacts, calendar dates, notes, comments, and resource attachments now write their change and their activity history inside one Postgres function. If either fails, neither is left behind. Where the shape allowed it, the history moved onto database triggers so it is recorded by the database rather than by whichever code path remembered to — the gap that had been open since v0.4.

### Named validation errors

The resource mutations used to raise `23514` for their own validation failures, which is the same SQLSTATE Postgres raises for a real check constraint. The API could not tell "you picked an owner who has not finished onboarding" apart from a constraint violation, so it answered both with a banner that named nothing. Those raises now carry `RS001`, and the API returns their message verbatim.

### Assignees moved to the relation

`task_assignees` had existed since the baseline schema but only ever mirrored `tasks.assignee_id`. The join table is now the source of truth — it already carries the row-level policy for who may be assigned in a project, and it is already published to realtime. The old column is kept synchronized to one deterministic assignee so a rollback can still read the task.

### Indexes for the Activity page

Every Activity page load ordered the audit table by timestamp under a JSONB containment predicate, with no index for it — a full scan and a sort on every visit. Two indexes now cover it.

### CI that can say no

Continuous integration runs typechecking, unit tests with a coverage floor, and the Playwright end-to-end suite covering the critical workspace workflows. The production build still runs the database contract check first.

## Still in beta

Page access covers Notes, Contacts, and the Calendar. Projects and categories keep their own visibility controls, while group detail and **View as** explain the combined result without becoming another place to configure it.

The editors are split between full pages and dialogs, which means the same form exists as two layouts that have to stay in step; the new preference decides which one you meet, not how many there are. Contacts have only the page, so it is the one editor the preference cannot change. The read-only MCP connection is available only on deployments configured for it, and it stays read-only — an assistant can answer questions about the workspace but cannot act in it.
