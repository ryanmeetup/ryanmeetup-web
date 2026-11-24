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

### More welcoming empty states

Empty views now have more breathing room, a context icon, and readable guidance.
Create a first item or clear a search right from the empty view where available.
Review queues make it clear when you’re caught up, and notes, contacts,
projects, categories, and dashboard cards share the same treatment.

### Moderate store reviews

App owners can review buyer submissions from Store Reviews in the sidebar,
below RY-D Verification, when the store integration is enabled. A red badge
counts the reviews waiting for a decision and drops as you work through them. Compare a waiting edit with its approved version,
publish or reject it, and hide or restore published reviews. Publishing saves in
one click. Rejecting asks for a reason written to the buyer, who sees it on My
reviews until they edit and resubmit. Hiding asks for a private reason that stays
with the decision history. If another person or
the buyer changes a review while it is open, the queue refreshes before another
decision. Buyer withdrawals stay withdrawn.

Write, edit, or remove an official public reply from the same queue. Preview
the exact reply before publishing; hidden reviews stay hidden when you reply.

Preview buyer photos alongside the text. Publishing a review publishes its
photos too, so reject any photo that should stay off the storefront first.
Only approved photos on the published version appear in the store; hiding,
withdrawal, replacement, and deletion revoke their public links. Rejecting a photo asks for
a reason written to the buyer. It shows under the photo in the queue, and the
buyer sees it on My reviews and beside the photo when they edit.

Rejected reviews are kept, never deleted. Find them in the Rejected queue and
publish one anyway if you change your mind. Narrow any queue to a single
product with the Product filter, or search the loaded reviews by product, reviewer, or review
text.

Move between review pages and choose the number of rows with the same
pagination controls used elsewhere in the workspace. Previous pages stay
available, and bulk selection applies to the reviews on the displayed page.
The pagination bar counts every review in the queue, not only the ones loaded so
far. Sort the queue by product, status, or submission time from the column
headers, or from the Sort menu on narrow screens; the sort stays in the page
link.

Reviews brought over from the Etsy shop arrive already published, dated when
they were left on Etsy. They carry a Verified Etsy purchase badge instead of
No matching order, may have no title, and show Imported in their history.

Select individual reviews or all loaded reviews, then publish, reject, hide,
restore, or delete them in bulk. Each action shows how many selected reviews
are eligible. Rejection and hiding still require a reason; deletion keeps its
policy confirmation and logs every review separately. A changed review is
skipped, and an unconfirmed save stops the batch with a clear result count.

The queue is a table with one row per review: review text, product, photos,
reviewer, status, and actions each get a column. A waiting edit sits above the
published version it would replace, and an official reply shows under the review.
Decisions are buttons on the row; replies, hiding, history, and deletion sit in
its menu, and each photo's menu views, approves, or rejects it. Narrow screens
stack each row into one readable column.
Every saved review decision, reply, photo decision, and deletion shows a success
notification, even if the queue cannot reload afterward.
Purchase badges match the store, including a neutral “No matching order” badge
with an explanation of what the order check means.

Delete spam for good from any review's menu. The confirmation
lists the FTC's rules on removing reviews, asks for one of the allowed reasons,
and has you confirm the rating played no part. Each deletion is logged with its
reason, rating, and who deleted it, but not the review text.

### Save a focused task view

Save your current task filters, exclusions, sort order, and board or list layout
as a personal view, then switch between working contexts from the Views picker
in the filter panel header. Saved view controls use consistent sizing and styling
and stay available when filters are collapsed.
Changes stay temporary until you update the saved view; reset them or save a
new view instead. Rename and delete views from Manage saved views. Your views
follow your account across devices, with separate collections in each instance.
If saved views cannot load, the controls explain whether workspace setup,
access preview, or browser storage is responsible and offer retry where possible.

### Closed projects leave the current workspace

Projects marked Complete or Dropped move out of the Current view, Favorites, the sidebar, the calendar, search, and the project pickers for new tasks. Closing replaces the separate Archive step, so finishing a project is one change instead of two, and its timeline stops on the day it closed. Dropped covers the projects that end without shipping, so they no longer have to pose as Paused forever. Both remain available in a dedicated Closed view, keeping active navigation focused while preserving the project as a record.

### Notes get a title of their own

New notes ask for a title separately from their details, so the first line no longer has to do both jobs. Notes open in Cards for roomier previews; choose Table for a compact list with separate columns for category, author, update time, and comments. Both views offer converting, editing, archiving, and deleting from each note's menu. The same actions are available inside the note's detail dialog and dedicated page, including restoring archived notes. Your last selected view is remembered in this browser. Shared links can still specify a view for that visit, alongside search and category filters. Search by title, details, or author beside a Category filter, and start a note from New note. Narrow screens stack each note into one readable column. The detail dialog groups authorship, update time, comments, and body content more clearly, with a roomier composer when a conversation opens.

### Category tags can follow the work

Categories are no longer limited to 20 tags. Owners can drag tags into the order that makes sense for the category instead of accepting creation order forever.
In the task tag picker, each category heading now collapses its tags, so a long list like Chapters can fold away while you pick from the others. A collapsed heading still counts its selected tags, and searching looks through every category.

### RY-D cards print exactly as approved

Each RY-D order now carries its card: first name, last name, location, and
Ryan since. The card starts from Chipply's Options Detail when the export has
it. Upload orders takes Chipply's full data export as well as the order
summary, and the full export fills in each card from what the buyer typed,
including for orders that first arrived in an order summary, unless their card
was already saved. An
order with more than one RY-D is named after the upload, since only its first
card can be imported. A birthday with a two-digit year offers its year for you to accept, and
one with no year waits for you to add it. Locations are written as city and
state, such as "Brooklyn, NY", whenever both can be read. Verifying approves the card as
shown and needs every line, so nothing prints with a blank.

In the Verified view, select orders in Ready to send or Sent to fulfillment,
or Select all, and choose Download cards CSV for a four-column file in
fulfillment's own wording (Order ID#, First & Last, Location, Date).
Downloading moves no stage, so the same cards can be downloaded again any time.
A card missing its name, location, or year is left out of the file and shows
a warning beside the Ryan's name saying which lines it needs. Set the Card
filter to Missing a line to list only those orders.
A card that has gone to fulfillment is locked; click the lock beside Card in its
review to correct it without moving the order out of Sent to fulfillment.

### Guest tiers for partners

A tier can now be a guest tier, for someone outside the organization such as
a fulfillment partner. Guests reach only the pages and work granted to their
tier or team. Projects, categories, and pages open to the workspace stay
closed to them, and their sidebar shows only what they can open.

### Email every selected RY-D buyer

Bulk actions now include Blank email, in every view and fulfillment stage. It
opens an empty email in your mail app with every selected buyer in Bcc,
whatever their order's status, and lists each buyer once. A large selection is
split into several emails so each one still opens. Nothing is recorded as
contacted.

## Improved

### Create from the header

The header's New menu brings New task, New project, and New category together,
with the options your account can use. On a phone it stays a compact plus button,
and each option follows your preferred form layout.

### RY-D orders fit your phone

The RY-D queue switches to stacked orders when space is tight, keeping names,
emails, status, form matches, order details, and review actions visible without
sideways scrolling. Sorting, selection, follow-up emails, and production progress
stay available in the compact layout. Bulk selection tools start collapsed behind
Bulk actions; expand them when needed, and collapse them without losing your
selection.

### More pages for phones

Notes, new tiers and teams, digest cadence and structure, sent emails, and
Google Calendar invites now open as full pages on a phone instead of cramped
dialogs, following your preferred form layout. Notes have their own address, so
a shared link opens the note itself. Desktop keeps the familiar dialogs.

### A consistent, more compact text scale

Fields, placeholders, page descriptions, card summaries, search, menus, and
everyday interface text now share a compact 13px scale across phones and desktop.
Task titles use a slightly larger 15px size in boards and lists so they stand
out from their descriptions. Project and note card titles keep their compact size.
Smaller labels and metadata, consistent
supporting copy, and a clearer heading hierarchy make the workspace easier
to scan without oversized fields or cards.

### A clearer way back from missing pages

Missing pages now show a name-tag 404 with links back to the task board and
workspace home, plus guidance for checking shared links and access.

### RY-D settings have their own access

RY-D Settings is locked separately from the queue, so someone can verify
orders and download card files without changing the review form, fulfillment's
address, the upload reminder, or the Google connection. Settings opens only to
app owners and workspace-wide tiers such as R-Suite, and no team or guest tier
can be added to it.

### Tiers and teams, side by side

The Access page lists organizational tiers and teams in their own sections,
each with its own create button and a line on what it is for. Tiers list from
highest to lowest, and their cards mark guest, workspace-wide, and new-member
default tiers.

Inviting a teammate sets their app role, tier, and teams in the same step, so
a partner arrives in a guest tier with only the team they work with. A guest
with nothing shared yet is welcomed with what the workspace is and who to ask
for access, instead of landing on an empty profile. A guest whose team has a
current project, such as RY-D, gets the Dashboard, Tasks, and that project's
page, showing only the projects shared with them.

### View as shows what they see

Viewing as a tier or a teammate now shows their workspace exactly: their
navigation, their buttons, and the pages a guest is sent to instead of the
Dashboard. You can move around as they would, but nothing in the preview can
be clicked, typed into, or dragged.

To check a combination before anyone holds it, such as a guest tier with the
RY-D team, pick a tier and any teams under Preview a combination on the Access
page.

### Chipply exports import as written

Order files that aren't UTF-8 keep accented names like Pérez intact, and
values Excel wraps as `="607227"` import as `607227`.

### Reliable RY-D imports and reminders

Uploads now save their orders, counts, and history together. Overlapping uploads report only what each added, and retrying the same upload keeps its original result. Damaged CSV rows are reported before saving.

Single and bulk buyer emails share one draft workflow. Select all in the Pending queue and choose Email selected to nudge every buyer to verify in one Bcc draft, or Mark contacted to record outreach made elsewhere. Each order shows when its buyer was last contacted. Opening a draft records nothing; confirm each sent group separately. Large selections become smaller drafts, and retrying a confirmation cannot record it twice.

### Fulfillment files stay in sync

Generated files include only verified orders that have not already gone to fulfillment. Orders already sent, completed orders, and orders still being checked stay out of the next file and email draft. Fulfillment emails name the Ryan from linked form responses and identify the buyer separately for gifts. Regenerate refreshes the selected draft from the form.

Verified opens to Ready to send, followed by Sent to fulfillment, In production, and Done. Select ready orders across pages and choose Generate email & CSV to prepare exactly that selection for your email app. Emails and files are generated on demand, with no saved drafts or replacement prompts. Every stage change is manual: mark orders Sent to fulfillment after emailing them, Mark in production once fulfillment confirms they're being made, and Done when they're finished. Each stage shows the date it began, and In production can be skipped.

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

The RY-D access team can manage verification and fulfillment. Settings and
the Google connection stay with workspace-wide tiers and app owners, while
other members need the RY-D team grant.

If RY-D's page-access configuration is missing, access stays with app owners
until it is restored. Reviews and reminder recipients follow the same rule.

### Safer RY-D bulk actions

The Progress column sorts verified orders by handoff stage or production start date, with choices for either direction.

Large production selections save in bounded groups with visible progress and safe retries. Mixed backward moves save together. Unmatched emails confirm each sent draft independently, contact retries cannot count twice, and a person's responses link together. Actions wait while search results catch up.

Select orders to verify, request more information, or reject them together.
Confirm before saving; orders already with fulfillment stay protected, and
failed decisions stay selected for another try.

Bulk verification now shares a form read across each group of orders, so large
selections save faster. Unfinished cards and refused decisions stay selected,
and orders already with fulfillment stay protected.

### Remember the weekly RY-D upload

RY-D can email the verification team to check for fulfillment's next order
file, with a configurable day and hour in the workspace time zone. The page
also flags when an upload is due and clears the reminder after an upload.
The upload-day banner loads reliably across browser language settings and
shows its deadline in the workspace time zone.
Dismiss the banner once you have checked, and it stays away until the next
upload day.
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

### Finished RY-D orders step aside

Orders marked done more than 30 days ago no longer load with the queue, so it stays quick as the weeks pile up. The Done filter says how many are tucked away, and Show older brings them back.

### Faster RY-D evidence loading

Evidence thumbnails share brief form reads, so opening several uploads no longer reloads every form answer for each file. Google requests time out and stop when their readers cancel, while each file still requires current RY-D access.

RY-D's Google connection now requests read access to the form and uploaded
files without spreadsheet write access. Existing connections keep working;
disconnect and reconnect once to replace the previous grant.

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

### Tooltips load reliably

Pages with tooltips no longer fail to load when their content arrives from the server.

### Task attachments appear once

Adding a link or uploading a file no longer shows it twice when the live update arrives before the save finishes. Removing an attachment leaves the task's other attachments in place.

Task links can also have a title you choose, including links added while creating a task. Links show a preview image when the destination provides one, with the usual link icon as a fallback.

### Search stays readable on small screens

The header search leaves more room for its placeholder when its clear and loading controls are hidden.

## Under the hood

The latest organization work reuses the project lifecycle, archive, dropdown, and sortable-list foundations already in the app. Proximity-based dropdown options remain visible while navigating long menus, and the board's drag behavior is covered at the mutation and workspace-navigation boundaries.

## Still in beta

Separating completed projects and keeping navigation preferences makes the workspace calmer, but it does not define production readiness on its own. The path to v1.0.0 still depends on an explicit readiness review rather than the next available version number.
