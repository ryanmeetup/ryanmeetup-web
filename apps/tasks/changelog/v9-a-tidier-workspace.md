---
version: "0.9.0"
slug: v9-a-tidier-workspace
author: Ryan Le
date: "2026-09-15"
dateLabel: September 14–15, 2026
title: A tidier workspace for finished work, notes, and focused boards
summary: Completed projects moved out of the everyday workspace, notes and category tags became easier to organize, and the board gained quieter loading, navigation, and drag behavior.
overview:
  - Separate Current and Completed project views
  - A denser archive grouped around its task keys and closing dates
  - Note titles separated from note details
  - Category tags with no 20-tag ceiling and a sortable order
  - A desktop sidebar that can stay hidden between visits
  - Skeleton loading for activity and more predictable board drops
---

## New

### Completed projects leave the current workspace

Projects marked Complete move out of the Current view, Favorites, and the sidebar without needing to be archived. They remain available in a dedicated Completed view, keeping active navigation focused while preserving the finished project as a record.

### Notes get a title of their own

Quick notes now ask for a title separately from their details, so the first line no longer has to do both jobs. Note cards and the detail dialog group authorship, update time, comments, and body content more clearly, with a roomier composer when a conversation opens.

### Category tags can follow the work

Categories are no longer limited to 20 tags. Owners can drag tags into the order that makes sense for the category instead of accepting creation order forever.
In the task tag picker, each category heading now collapses its tags, so a long list like Chapters can fold away while you pick from the others. A collapsed heading still counts its selected tags, and searching looks through every category.

## Improved

### Reliable RY-D imports and reminders

Uploads now save their orders, counts, and history together. Overlapping uploads report only what each added, and retrying the same upload keeps its original result. Damaged CSV rows are reported before saving.

Single and bulk buyer emails share one draft workflow. Opening a draft records nothing; confirm each sent group separately. Large selections become smaller drafts, and retrying a confirmation cannot record it twice.

### Fulfillment files stay in sync

The download, email draft, and send confirmation now use one saved batch. Ready orders stay reserved until it is marked sent or explicitly cancelled, and later verifications wait for the next file. Closing resumes the same batch, and retrying a confirmation cannot clear orders or record the send twice.

New batches include only verified orders that have not already gone to fulfillment or production. Orders in production, completed orders, and orders still being checked stay out of the next file and email draft.

Response-sheet updates require a unique tab and matching response. After marking a batch sent, review which responses were updated, already ticked, missing, ambiguous, or unchecked. Uncertain updates stay available for a manual check without repeating the send.

### Keep email-less submissions separate

Form responses without a usable email stay separate in Unmatched submissions. Linking one attaches only that response, and email actions stay unavailable until there is an address to contact.

### Safer RY-D reviews

Pairing evidence and verifying an order now save together. Conflicting reviewers cannot claim the same response, stale decisions are refused, and production changes keep their audit history in the same transaction. Changing the verification form requires resolving its saved pairings first.

Ambiguous name and email questions now show a warning and keep their answers
available for review. Invalid order emails no longer fall back to a different
Google sign-in address. Settings also distinguishes the buyer verification
link from the form reviewers read, so changing one does not imply both changed.

### Delegate RY-D operations

The RY-D access team can manage verification, fulfillment, settings, and the
Google connection. Administrator tiers and app owners retain access, while
other members need the RY-D team grant.

If RY-D's page-access configuration is missing, access stays with app owners
until it is restored. Reviews and reminder recipients follow the same rule.

### Safer RY-D bulk actions

The Production column now sorts verified orders by production stage or sent date, with choices for either direction.

Large production selections save in bounded groups with visible progress and safe retries. Mixed backward moves save together. Unmatched emails confirm each sent draft independently, contact retries cannot count twice, and a person's responses link together. Actions wait while search results catch up.

Select orders to verify, request more information, or reject them together.
Confirm before saving; orders already with fulfillment stay protected, and
failed decisions stay selected for another try.

### Remember the weekly RY-D upload

RY-D can email the verification team to check for fulfillment's next order
file, with a configurable day and hour in the workspace time zone. The page
also flags when an upload is due and clears the reminder after an upload.

### Refresh RY-D without losing saved changes

Refresh picks up new form responses without leaving the queue. Confirmed reviews, pairings, settings, and removed responses stay visible if reloading fails, with a clear retry action.

### Read every unmatched response

Both submission layouts now offer complete response details, including every upload and answer. Shared uploads appear once, people stay together across pages, and search finds names, emails, and form answers. Bulk selections follow the filtered people across pages.

### Faster RY-D evidence loading

Evidence thumbnails share brief form reads, so opening several uploads no longer reloads every form answer for each file. Google requests time out and stop when their readers cancel, while each file still requires current RY-D access.

### More reliable RY-D verification

Large order queues and fulfillment exports keep every order, and saved CSV cells survive changes to column capitalization or later files. Verification handles malformed social links and uploaded filenames with international characters, avoids combining names from different responses into a strong match, and keeps rejected orders out of reminder actions. RY-D access stays closed when its permission checks are unavailable.

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
