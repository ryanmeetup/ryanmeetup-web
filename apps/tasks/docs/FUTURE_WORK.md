# Tasks future work

This document records product opportunities for the Tasks app. It is a product
backlog, not a commitment or implementation sequence. Items should be validated
against real workspace usage before they become release work.

The app already covers task boards and lists, projects, categories and tags,
multiple assignees, checklists, threaded comments, attachments, notes, contacts,
a shared calendar with Google Calendar sync, activity history, granular access
groups, weekday digest emails, and read-only MCP access. The opportunities below
focus on helping people notice, plan, and finish work rather than recreating
features the app already has.

## Candidate priorities

### 1. Notifications and working reminders

Tasks already persists `reminder_at`, while the task editor presents the
control as coming soon. Complete that promise with an attention layer rather
than an isolated email job.

A useful first version would include:

- an in-app inbox with read and unread state;
- assignment, mention, due-date, reminder, and followed-thread events;
- email delivery for explicit reminders and important events;
- per-person event and delivery preferences;
- links that take the recipient directly to the relevant task or comment; and
- deduplication so realtime updates, inbox entries, digests, and emails do not
  become four copies of the same message.

The existing weekday digest should remain the summary surface. Notifications
should cover timely or directed attention that cannot wait for the next digest.

### 2. Recurring tasks

Routine operational work currently needs manual duplication. Support daily,
weekly, monthly, and simple custom schedules. Prefer creating the next task when
the current occurrence completes so an abandoned series does not fill the board
with overdue copies.

Each generated occurrence should preserve the template's project, categories,
tags, assignees, priority, description, and checklist while receiving a new task
key and activity history. Calendar recurrence already establishes useful
product language and date-expansion rules, but task recurrence needs separate
completion and generation semantics.

### 3. Saved views

The task workspace already supports strong, shareable query filters. Let people
save that state as named views such as **My urgent work**, **Unassigned intake**,
or **Launch blockers**.

Saved views could be personal or shared, pinned in the sidebar, and include the
board/list choice, filters, exclusions, sort, and page size. A later version
could subscribe a person to a saved view's digest or alert only when new work
enters it.

### 4. Dependencies and blockers

Add task-to-task **blocked by** and **blocks** relationships. Surface blockers
on task cards and detail pages, distinguish a blocked task from one that is
merely in progress, and optionally warn before completing tasks out of order.

The first version should avoid a full dependency graph editor. Searching for
and linking another task, displaying both directions, and removing the link are
enough to validate the workflow.

### 5. Bulk task operations

Add multi-selection to the list view for high-volume triage. Initial actions
should cover status, assignees, project, categories, priority, due date, and
archive. Every operation must preserve access rules, transactional activity,
and clear partial-failure behavior.

Board multi-selection and drag are more complex and can wait until list-based
bulk editing proves useful.

### 6. A real project overview

Give each project a destination that explains its purpose, current state, and
what needs attention. Stage 1 shipped in v0.8.0; possible planning and portfolio
extensions remain explored below.

### 7. Task templates

Managed templates should complement one-off task duplication. A template can
hold a default title pattern, description, checklist, project, categories,
tags, assignees, priority, and relative schedule. Recurring tasks should
eventually use the same template semantics rather than maintaining a second
copy mechanism.

### 8. Personal digest and timezone settings

Digest timing and structure are currently workspace-wide. Add a profile
timezone, enabled sections, preferred delivery days, and pause controls before
the workspace spans several operating timezones. Preserve owner ceilings and
delivery observability.

### 9. Import, export, and automation hooks

Start with scoped CSV task import/export and outbound webhooks for important
task events. These provide portable data and general integration points before
the app accumulates bespoke third-party integrations.

Any write-capable API or MCP expansion needs explicit scopes, audit activity,
rate limits, idempotency, and the same access checks as the browser application.

### 10. Finish mobile note editing

Create a real `/notes/[id]` route and full-page mobile create/edit experience.
The current rich note and comment experience shares a capped dialog, which the
mobile editor audit identifies as the most painful remaining phone surface.

## Deliberate non-priorities

Do not prioritize chat, time tracking, Gantt charts, arbitrary custom fields,
or AI-generated task descriptions without a demonstrated workspace need. Each
would add considerable product and interface weight without first solving the
clearer problem: directing the right person's attention to the right work at
the right time.

## Project overview exploration

### Product problem

The Projects page is currently a directory grouped by lifecycle. A project card
shows its description, links, owners, task count, status, access, and favorite
state. Its primary work-oriented destination is the task board filtered to that
project.

That answers **which projects exist?** and **which tasks belong here?**, but not:

- What is this project trying to accomplish?
- Is it moving, stalled, or nearly done?
- What needs attention today?
- Which dates and decisions matter next?
- Who owns the outcome?
- What changed recently?

The overview should answer those questions without becoming a miniature copy
of every app page.

### Primary user jobs

1. A contributor opens a project and immediately finds the next relevant work.
2. An owner scans progress, overdue work, unassigned work, and upcoming dates.
3. A teammate who has been away catches up through recent activity and project
   context.
4. Someone sharing a project link lands on a readable summary rather than a
   preconfigured board query.

### Recommended route and navigation

Use a readable project route such as `/projects/[slug]`. Resolve names only
against projects the viewer may access, accept the project id as a legacy or
ambiguity fallback, and canonicalize to the readable form where practical.

Project cards, favorite-project dashboard entries, task project links, global
search, and calendar project references should lead to the overview. The
overview should offer explicit **Open task board** and **Edit project** actions; it
should not remove the filtered board.

### Recommended information architecture

#### Header

- Breadcrumb back to Projects.
- Project name, lifecycle status, favorite control, and owner avatars.
- Concise description or objective.
- Primary **Open task board** action and secondary **Edit project** action.
- Access-preview treatment and read-only behavior consistent with other pages.

#### At-a-glance strip

Derive four compact measures from existing data:

- open tasks;
- overdue tasks;
- due in the next 14 days; and
- completed tasks or completion percentage.

Each measure should link to the board with the corresponding project and task
filters. Counts need accessible text and must not rely on color alone.

#### Needs attention

This should be the first substantial section. Show a small, bounded list of:

- overdue active tasks;
- urgent or high-priority unassigned tasks;
- later, tasks blocked by unresolved dependencies.

Use explicit reasons such as **Overdue by 3 days** or **Urgent and unassigned**.
Do not infer and display a project-health label from these signals; that would
turn a heuristic into an unexplained judgment.

#### Progress by status

Show the project's task distribution using the workspace's configurable
statuses. A compact segmented bar plus counts is sufficient. Completed statuses
should roll into the completion total, while every segment remains named in
text and links to the corresponding filtered board.

Projects with no tasks need a purposeful empty state and a prefilled **Create
the first task** action.

#### Upcoming dates

Combine task deadlines and project-linked calendar entries into one short,
chronological list. This provides useful milestone behavior immediately because
the calendar already supports important, recurring, and Google-published dates.
The full calendar remains the place for month-level planning.

#### Project context

Render the existing links, attachment notes, and files as supporting context.
Do not introduce a second project-document model. A later iteration can decide
whether general Notes need an explicit many-to-one project relationship.

#### Recent activity

Show a bounded feed of project changes and changes to its tasks. Include a
**View all activity** link with a project filter instead of embedding the full
Activity page.

### Suggested desktop composition

Use one primary column and a narrower context rail:

- Main: Needs attention, progress by status, and upcoming work.
- Rail: owners, project context, upcoming dates, and recent activity.

On mobile, stack the same sections with Needs attention first. Avoid tabs in the
first version; a single scannable page provides a clearer overview and does not
hide sparse sections behind navigation.

### MVP that requires little or no new schema

The initial overview can derive almost everything from existing records:

- project name, description, lifecycle status, access, and links;
- owners and favorite state;
- related tasks, assignees, priorities, statuses, and due dates;
- project attachments;
- project-linked calendar events; and
- project and related-task activity.

This makes the first release primarily a route, scoped server loader, selectors,
and presentation work. It also allows real usage to reveal which new project
fields are actually needed.

### Possible schema additions after validation

Consider these only after the derived overview ships:

- `target_date`: when the project as a whole is expected to finish;
- `health`: an owner-set value such as on track, at risk, or off track;
- `health_note`: the dated explanation behind the current health; and
- explicit project milestones if calendar entries prove too general.

An objective may not need its own field initially because the existing project
description can carry it. If health is added, it should always be intentionally
set by a person and accompanied by context, never silently calculated from task
counts.

### Access and loading constraints

- Resolve and load only a project the viewer can read.
- Preserve category restrictions when listing the project's tasks.
- Do not expose owner-only access metadata to regular members.
- Make overview counts use the same visible task set as the linked board so the
  two surfaces cannot contradict each other.
- Load project-specific tasks, owners, attachments, calendar entries, and
  activity on the server rather than pulling the whole workspace into a new
  client page.
- Keep access-preview sessions read-only and apply the preview to every linked
  destination.

### Staged delivery

#### Stage 1: Derived overview

Status: implemented in v0.8.0.

- Readable project detail route.
- Header, owners, status, description, and actions.
- At-a-glance counts.
- Needs-attention task list.
- Progress by status.
- Upcoming task and calendar dates.
- Existing links and attachments.
- Recent activity.

#### Stage 2: Project planning

- Project target date.
- Owner-written health and health note.
- Explicit milestone model only if calendar entries are insufficient.
- Project-specific saved views.

#### Stage 3: Portfolio view

- Cross-project health, overdue work, owners, and target dates.
- Workload/capacity signals.
- Reporting and export.

Portfolio reporting should follow—not precede—the single-project overview,
because the underlying project signals need to become trustworthy first.

### Questions to validate

1. Is the overview mainly for contributors choosing their next task, or owners
   reporting project health?
2. Should project health be explicitly written by an owner, or omitted until
   the app has enough evidence to justify it?
3. Are project-linked calendar entries sufficient as milestones in practice?
4. Does a project need one target date, or do real projects mostly have several
   meaningful dates?
5. Should project context remain attachment notes and files, or should general
   Notes be linkable to projects?
6. Which section would make someone open the overview every day rather than
   jumping directly to the board?

### Recommended starting point

Build Stage 1 without adding project fields. Lead with **Needs attention**, use
the filtered board as the drill-down, and observe whether people ask for target
dates, health reporting, or formal milestones. This produces a useful project
home quickly while keeping later planning concepts grounded in actual use.
