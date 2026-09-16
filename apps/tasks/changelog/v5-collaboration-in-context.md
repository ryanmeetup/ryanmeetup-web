---
version: "0.5.0"
slug: v5-collaboration-in-context
author: Ryan Le
date: "2026-08-22"
dateLabel: August 20–22, 2026
title: A team calendar, Google OAuth, and weekday digest email
summary: The workspace grew two integrations it did not have before — read-only Google Calendar and transactional email through Resend — alongside collaborative notes, threaded comments, and the first pass at making the app configurable per deployment.
overview:
  - A shared calendar for deadlines, important dates, and time away
  - Read-only Google Calendar connections per teammate
  - Weekday digest email through Resend, with an owner-facing usage page
  - Collaborative notes, threaded task comments, and linked task references
  - The app parameterized per instance, with an owner-only Admin section
---

## New

### One calendar for the Ryan schedule

The new Calendar brings task deadlines, project or category milestones, and team time away into one monthly view. Sensitive dates follow the same project and category access rules as the work they describe, enforced where the rows are read rather than by hiding them in the UI, while away periods help everyone know when a Ryan is unreachable.

Each Ryan can connect their primary Google Calendar with read-only access, bringing personal meetings into the shared view without exposing them to teammates.

### Weekday task rundown

Assignees receive one concise weekday email grouping overdue work, today's deadlines, upcoming tasks, and high-priority work without a due date. Empty rundowns are skipped to keep inboxes — and the email budget — tidy.

Those rundowns mirror the task board more closely, with higher-contrast cards, icon-led sections, and roomier task metadata for quicker scanning.

Workspace owners can monitor Resend's daily and monthly email allowance, recent sends, and delivery state from the new Usage page.

### Notes that become tasks

Converting a note into a task removes the original note and opens the new task directly, keeping the workspace tidy and the next step close at hand.

Category filters keep every kind of note visible in one compact row, while each note carries its category label for faster scanning.

### Collaborative note conversations

Teammates can comment on notes, with authors able to edit or remove their own comments.

### Threaded task comments

Comments support nested replies, making it clear which message a teammate is responding to while keeping the full conversation together.

## Improved

### Complete teammate onboarding

Invited teammates choose their sign-in password while completing their profile, so they can return to the workspace without needing a password-reset workaround.

### Dynamic task filters

Tasks can be included or excluded by category tags. Tag choices stay in sync with each category, so renamed, added, and removed tags are reflected automatically.

### Faster dropdowns

Dropdown menus stay compact, include search, and keep your own profile close to the field when choosing an assignee or reporter. Favorite projects appear first when choosing a project.

### Connected task links

Task creation and edit confirmations include the task number as a direct link. Ticket keys written in comments, such as RMT-123, resolve to the referenced task when it exists.

### Focused task editing

Editing from a task page stays on task fields while checklist items, attachments, comments, and activity remain where they already are. On wide screens, task details and activity stay in view while the main task work scrolls.

### Richer resource management

Supporting links, notes, and attachments are reorderable by touch, pointer, and keyboard, and supporting notes accept Markdown. Modal headers and action bars stay in place while longer content scrolls between them. Empty projects and categories can be permanently deleted.

### Organized contacts

Contacts are grouped by relationship — brand partners, venues, media, talent, hospitality, event vendors — so a growing network stays scannable.

## Under the hood

### Two external services to keep alive

Google Calendar is a per-teammate OAuth connection scoped to read-only, and digest mail goes out through Resend on a scheduled route. Both are metered and both can fail in ways the workspace cannot, which is why the Usage page exists at all: the allowance is small enough to be worth watching.

### Reordering with dnd-kit

Link, attachment, and note ordering moved onto dnd-kit so dragging works the same way with a pointer, a finger, and a keyboard, rather than being a mouse-only affordance.

### lib grouped by domain

The `lib` directory was regrouped by domain — access, activity, workspace, server — instead of by file type. Imports now say which part of the app a module belongs to.

### One deployment, then many

The compiled identity was parameterized so the app is no longer hardcoded to one organization, and an owner-only Admin section was added to hold the settings that come with that.

## Still in beta

Google Calendar was connected per person here; v0.6.0 replaced that with one workspace calendar granted through access groups, so anyone who set up the first version had to set it up again. Digest email had no preview or cancel path yet — it sent on a schedule and you found out what it said when it arrived.
