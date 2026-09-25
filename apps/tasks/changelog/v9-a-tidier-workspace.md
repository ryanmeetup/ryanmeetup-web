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

Activity feeds show skeleton rows while a request is pending, preserving the shape of the page rather than replacing it with a lone loading message. The stale content remains clearly unavailable until the newest response arrives.
Project attachment lists now use the same card-shaped loading treatment instead of adding status copy beneath their descriptions.
The project-context dialog reserves its final responsive height while those skeletons load, keeping its scroll area and footer stationary.

### Predictable board drops

Dropping a task into the open space of a column now puts it at the top by default. The blue insertion bars still place it exactly where chosen, and mobile spacing keeps the board controls and columns from crowding each other.

### Clickable links in task descriptions

Web addresses pasted into a task description now appear as clickable links on the board and task detail page, opening the destination in a new tab.

### Check off work while creating a task

Checklist items can now be marked complete before a new task is created. Their checked state also stays intact in saved drafts and on the finished task.

## Under the hood

The latest organization work reuses the project lifecycle, archive, dropdown, and sortable-list foundations already in the app. Proximity-based dropdown options remain visible while navigating long menus, and the board's drag behavior is covered at the mutation and workspace-navigation boundaries.

## Still in beta

Separating completed projects and keeping navigation preferences makes the workspace calmer, but it does not define production readiness on its own. The path to v1.0.0 still depends on an explicit readiness review rather than the next available version number.
