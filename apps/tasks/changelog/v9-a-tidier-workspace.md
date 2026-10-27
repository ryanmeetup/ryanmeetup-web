---
version: "0.9.0"
slug: v9-a-tidier-workspace
author: Ryan Le
date: "2026-09-15"
dateLabel: September 14–15, 2026
title: A tidier workspace for finished work, notes, and focused boards
summary: Completed projects moved out of the everyday workspace, notes and category tags became easier to organize, and the board gained quieter loading, navigation, and drag behavior.
overview:
  - Closing a project puts it away, with a Dropped status for work that never shipped
  - A denser archive grouped around its task keys and closing dates
  - Note titles separated from note details
  - Category tags with no 20-tag ceiling and a sortable order
  - A desktop sidebar that can stay hidden between visits
  - Skeleton loading for activity and more predictable board drops
---

## New

### Closed projects leave the current workspace

Projects marked Complete or Dropped move out of the Current view, Favorites, the sidebar, the calendar, search, and the project pickers for new tasks. Closing replaces the separate Archive step, so finishing a project is one change instead of two, and its timeline stops on the day it closed. Dropped covers the projects that end without shipping, so they no longer have to pose as Paused forever. Both remain available in a dedicated Closed view, keeping active navigation focused while preserving the project as a record.

### Notes get a title of their own

Quick notes now ask for a title separately from their details, so the first line no longer has to do both jobs. Note cards and the detail dialog group authorship, update time, comments, and body content more clearly, with a roomier composer when a conversation opens.

### Category tags can follow the work

Categories are no longer limited to 20 tags. Owners can drag tags into the order that makes sense for the category instead of accepting creation order forever.
In the task tag picker, each category heading now collapses its tags, so a long list like Chapters can fold away while you pick from the others. A collapsed heading still counts its selected tags, and searching looks through every category.

### RY-D cards print exactly as approved

Each RY-D order now carries its card: first name, last name, location, and
Ryan since. The card starts from Chipply's Options Detail when the export has
it. A birthday with a two-digit year offers its year for you to accept, and
one with no year waits for you to add it. Verifying approves the card as
shown and needs every line, so nothing prints with a blank.

The Verified view's Card files panel downloads every approved card that
hasn't printed as a four-column file (Order Number, Name, Location, Ryan
Since) and marks those orders sent to fulfillment with the date, so no card
prints twice. Past files can be downloaded again without changing anything.

### Guest tiers for partners

A tier can now be a guest tier, for someone outside the organization such as
a fulfillment partner. Guests reach only the pages and work granted to their
tier or team. Projects, categories, and pages open to the workspace stay
closed to them, and their sidebar shows only what they can open.

## Improved

### RY-D settings have their own access

RY-D Settings is locked separately from the queue, so someone can verify
orders and pull card files without changing the review form, fulfillment's
address, the upload reminder, or the Google connection. It starts with the
same groups as RY-D, so nothing changes until an owner narrows it.

### Chipply exports import as written

Order files that aren't UTF-8 keep accented names like Pérez intact, and
values Excel wraps as `="607227"` import as `607227`.

### Reliable RY-D imports and reminders

Uploads now save their orders, counts, and history together. Overlapping uploads report only what each added, and retrying the same upload keeps its original result. Damaged CSV rows are reported before saving.

Single and bulk buyer emails share one draft workflow. Select all in the Pending queue and choose Email selected to nudge every buyer to verify in one Bcc draft, or Mark contacted to record outreach made elsewhere. Each order shows when its buyer was last contacted. Opening a draft records nothing; confirm each sent group separately. Large selections become smaller drafts, and retrying a confirmation cannot record it twice.

### Fulfillment files stay in sync

Generated files include only verified orders that have not already gone to fulfillment. Orders already sent, completed orders, and orders still being checked stay out of the next file and email draft. Fulfillment emails name the Ryan from linked form responses and identify the buyer separately for gifts. Regenerate refreshes the selected draft from the form.

Verified opens to Ready to send, followed by Sent to fulfillment and Done. Select ready orders across pages and choose Generate email & CSV to prepare exactly that selection for your email app. Emails and files are generated on demand, with no saved drafts or replacement prompts. Every stage change is manual: mark orders Sent to fulfillment after emailing them, and each one shows the date it was sent. Production happens in fulfillment's own system, so there is no separate production step to confirm.

### Keep email-less submissions separate

Form responses without a usable email stay separate in Unmatched submissions. Linking one attaches only that response, and email actions stay unavailable until there is an address to contact.

### Safer RY-D reviews

Order reviews keep a steady height, with collapsible Order, Card, and Notes
sections. On desktop, order details scroll separately from the form responses,
while the review actions stay in view.
Uploaded images open in a preview above the review, so closing one returns
to the same order and any unsaved changes.
Review actions explain what they do in tooltips. When Verify is unavailable,
its tooltip names the card fields that need attention, including when using
the keyboard.

Pairing evidence and verifying an order now save together. Conflicting reviewers cannot claim the same response, stale decisions are refused, and production changes keep their audit history in the same transaction. Changing the verification form requires resolving its saved pairings first.

Ambiguous name and email questions now show a warning and keep their answers
available for review. Invalid order emails no longer fall back to a different
Google sign-in address. Settings also distinguishes the buyer verification
link from the form reviewers read, so changing one does not imply both changed.

### Delegate RY-D operations

The RY-D access team can manage verification and fulfillment, and settings
and the Google connection with RY-D Settings access. Administrator tiers and app owners retain access, while
other members need the RY-D team grant.

If RY-D's page-access configuration is missing, access stays with app owners
until it is restored. Reviews and reminder recipients follow the same rule.

### Safer RY-D bulk actions

The Progress column sorts verified orders by handoff stage or production start date, with choices for either direction.

Large production selections save in bounded groups with visible progress and safe retries. Mixed backward moves save together. Unmatched emails confirm each sent draft independently, contact retries cannot count twice, and a person's responses link together. Actions wait while search results catch up.

Select orders to verify, request more information, or reject them together.
Confirm before saving; orders already with fulfillment stay protected, and
failed decisions stay selected for another try.

### Remember the weekly RY-D upload

RY-D can email the verification team to check for fulfillment's next order
file, with a configurable day and hour in the workspace time zone. The page
also flags when an upload is due and clears the reminder after an upload.
The order file can be dragged straight onto the upload dialog, and anything
other than a CSV is turned away before it's sent. It no longer needs a
Verified? column: every new order starts pending and is matched to the form's
responses as soon as it lands.

### Cancel RY-D orders that never verify

Rejected is now Cancelled. Select the orders, or open one, and Cancel orders
drafts a request asking fulfillment to cancel and refund them, plus a Bcc
notice telling each buyer their order was cancelled and refunded and why.
Marking them cancelled takes them out of follow-up for good.

### Refresh RY-D without losing saved changes

Refresh picks up new form responses without leaving the queue. Confirmed reviews, pairings, settings, and removed responses stay visible if reloading fails, with a clear retry action.

### Read every unmatched response

Both submission layouts now offer complete response details, including every upload and answer. Shared uploads appear once, people stay together across pages, and search finds names, emails, and form answers. Bulk selections follow the filtered people across pages.

### Faster RY-D evidence loading

Evidence thumbnails share brief form reads, so opening several uploads no longer reloads every form answer for each file. Google requests time out and stop when their readers cancel, while each file still requires current RY-D access.

### More reliable RY-D verification

Large order queues and fulfillment exports keep every order, and saved CSV cells survive changes to column capitalization or later files. Verification handles malformed social links and uploaded filenames with international characters, avoids combining names from different responses into a strong match, and keeps rejected orders out of reminder actions. RY-D access stays closed when its permission checks are unavailable.

### More RY-D matches found for you

Match suggestions now catch buyers the queue used to leave unmatched. An order number or order email typed anywhere on the form points straight at that order, including for gifts. One inbox written two ways, such as a Gmail address with or without dots or a `+tag`, counts as the same email. The same email name at another provider and a one-letter surname slip alongside a near email are offered as possible, and the buyer's own email is suggested even when the surname on the form differs. Every suggestion still says why and waits for a reviewer to verify.

### Give the workspace more room

The desktop sidebar can now be hidden from its header and restored from the workspace header. Tasks remembers that choice between visits, so focused work keeps the extra room until the navigation is needed again.

Project rows in the sidebar now open their task boards directly, while a dedicated action beside the board title opens the project's overview.
Links, notes, and files share one project-context group with a compact management action in its label, keeping content actions beside the content they change.
Inline Links, Notes, and Files labels keep each kind of project context distinguishable without splitting the header back into separate sections.
Project and category editing now sit beside the workspace title, leaving the right side of the header to the task-view controls.
On desktop, those view controls share one aligned toolbar beside the title while descriptions wrap to a readable measure beneath it.

### A more compact archive

Archived tasks lead with their task keys, group supporting details more tightly, and stay readable on narrow screens. Completed project dates, archive metadata, and workspace spacing now read consistently across desktop and mobile.

### Loading without a layout jump

Activity feeds show skeleton rows while a request is pending, preserving the shape of the page rather than replacing it with a lone loading message. The stale content remains clearly unavailable until the newest response arrives. A task's checklist, attachments, and comments do the same while the task loads, instead of sitting empty and then filling in all at once.
Project attachment lists now use the same card-shaped loading treatment instead of adding status copy beneath their descriptions.
The project-context dialog reserves its final responsive height while those skeletons load, keeping its scroll area and footer stationary.

### Predictable board drops

Dropping a task into the open space of a column now puts it at the top by default. The blue insertion bars still place it exactly where chosen, and mobile spacing keeps the board controls and columns from crowding each other.

### Clickable links in task descriptions

Web addresses pasted into a task description now appear as clickable links on the board and task detail page, opening the destination in a new tab.

### Finish a task from its page

A task's page now has a Mark complete button beside Edit task. It moves the task straight to your workspace's first finished status, without opening the editor. The task's menu offers the same shortcut for declining work as Will Not Do. Either one asks for a reason first when its status requires one.

### Lists keep their shape in previews

Bulleted, numbered, and checklist lines in a task description or note now stay as list rows on board and note cards. Long text is shortened by whole lines and ends with an ellipsis, rather than spilling past the preview or stopping mid-list without one. Comments on tasks and notes pick up the same formatting, including lists, bold and italic text, and clickable links, and task keys in a comment still link to their tasks.

### Check off work while creating a task

Checklist items can now be marked complete before a new task is created. Their checked state also stays intact in saved drafts and on the finished task.
On a saved task, each checklist item can now be renamed in place or copied to the clipboard, so fixing a typo no longer means deleting the item, and copying one no longer checks it off. On desktop the checklist now shows in full; on smaller screens a long one scrolls between clear top and bottom rules, and "Show all" opens it to full length.

## Under the hood

The latest organization work reuses the project lifecycle, archive, dropdown, and sortable-list foundations already in the app. Proximity-based dropdown options remain visible while navigating long menus, and the board's drag behavior is covered at the mutation and workspace-navigation boundaries.

## Still in beta

Separating completed projects and keeping navigation preferences makes the workspace calmer, but it does not define production readiness on its own. The path to v1.0.0 still depends on an explicit readiness review rather than the next available version number.
