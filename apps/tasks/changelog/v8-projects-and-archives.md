---
version: "0.8.0"
slug: v8-projects-and-archives
author: Ryan Le
date: "2026-09-10"
dateLabel: September 5–10, 2026
title: Project homes, honest outcomes, and an archive built as a record
summary: Projects gained a planning home and real timelines, statuses learned the difference between delivered and declined work, and the archive and calendar began telling that fuller story.
overview:
  - Project homes for progress, attention, dates, context, and recent work
  - Project start and due dates carried through to the calendar
  - Status outcomes that distinguish delivered work from declined work
  - An archive grouped by when work closed, with archived search results
  - Personal defaults for calendar sources and responsive editor layouts
  - Taller, independently scrolling board columns with pinned headings
---

## New

### Projects get a home of their own

Every project now opens to an overview instead of dropping straight into a filtered board. Open, overdue, upcoming, and completed work sits beside progress through the workspace's own statuses, tasks that need attention, owners, dates, links, notes, files, and recent activity. Each summary links back to the board with the matching filters already applied, and a board shortcut keeps the old straight-to-work path close.

Project context has its own focused editor. Saved links collapse into compact rows and use each page's social preview image when one is available. Projects also have their own start and due dates; new timelines begin on the day the project is created unless the work was already underway.

### Work can end without being delivered

A status now records whether work is open, delivered, or declined. **Will Not Do** is a declined ending, so turning down a task closes it without counting it as completed. It leaves open counts, digests, calendars, overdue lists, and project progress, then becomes eligible for automatic archiving.

### The archive becomes a record

Active and Archived are now a switch beside the board and list controls. Archived work opens as a list grouped by the month it closed, newest first, and shows its closing date instead of its old due date. Search finds archived tasks beneath everything still active, including direct matches by task key.

## Improved

### Calendars open on what matters

Each person can choose any combination of task deadlines, time away, important dates, and Google Calendar as their default calendar sources. Project milestones appear beside those sources, and Google connection state is clearer without making a connected account look like a button that still needs action.

### A board that uses the available screen

Board columns now have pinned headings and taller task lists that scroll independently. Collapsed columns retain their descriptions and search controls, open automatically when a search needs to show matches, and expand into visible drop targets while a task is being dragged. The board fills the usable viewport with balanced outside spacing and keeps its horizontal scroller reachable at the bottom.

### More resilient navigation and forms

Sign-in leaves stale router state behind, failed page loads retry once before raising an alarm, and token validation tolerates small clock differences. Responsive forms avoid Safari's focus zoom, preference cards and date fields stay contained on narrow screens, and mobile board controls use readable labels and full-width targets.

## Under the hood

### Safer database catch-up

The repository can build the exact migration block needed by an instance whose schema history has gaps. It checks the instance's complete applied history rather than assuming one version implies every earlier migration, which makes cross-instance recovery explicit and reviewable.

### Shared project and board foundations

Project context and timelines were consolidated into one details surface, board columns were separated into their own component, and task status changes now use the same behavior across activity surfaces. Those changes keep the richer project and archive views from growing parallel implementations.

## Still in beta

Project planning is derived from current tasks, milestones, and status history; it is not yet a dependency planner or portfolio forecast. Status outcomes improve reporting, but existing custom statuses still depend on an owner choosing the correct outcome.

