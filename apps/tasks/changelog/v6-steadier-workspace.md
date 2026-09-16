---
version: "0.6.0"
slug: v6-steadier-workspace
author: Ryan Le
date: "2026-08-27"
dateLabel: August 25–27, 2026
title: One workspace calendar, a demo that needs no database, and a shell that stays put
summary: Google Calendar was rebuilt as one shared workspace connection, new deployments open on a neutral demo built from fixtures rather than data, and the app learned to keep its navigation on screen while the next page loads.
overview:
  - One shared Google Calendar, granted through access groups
  - A neutral zero-configuration demo, previewable from Admin
  - Project lifecycle statuses from Discovery through Complete
  - Weekday digests you can inspect, delay, or cancel before they send
  - A persistent workspace shell and recoverable onboarding
  - A database contract check that runs before every production build
---

## New

### One shared calendar for the workspace

Owners connect one workspace Google Calendar and grant access through access groups. Events from Google appear automatically for permitted teammates, while tasks and dates created in Tasks stay in Tasks unless someone publishes them. Any important date or time-away entry can be copied to the shared Google Calendar with one checkbox, and editing or deleting the date keeps the Google copy in step.

Google events use their own magenta calendar notation so they stay distinct from blue task deadlines, and routine Home blocks no longer clutter the shared view. Time away stays at the top of each day, crowded dates open into a complete day agenda, the details sidebar can be hidden between visits, and Google connection controls live in a compact status badge above the calendar.

Connecting Google Calendar keeps deployment details out of the everyday flow: owners continue with Google when the workspace is ready, get a clear path to Admin when setup is still needed, and see friendlier guidance when a connection cannot be completed.

### A first look that needs no data

The zero-configuration demo opens as a neutral team workspace with sample teammates, projects, tasks, and calendar dates that fit any organization. The fixtures are compiled in, so the demo runs with no database, no seeding, and no chance of a preview writing to a real workspace. Demo mode skips the production notice and uses the compact footer, which is also the default treatment on sign-in and account-recovery screens.

New workspaces open with the complete Ryan Meetup workflow — Backlog, Todo, In Progress, In Review, Done, and Will Not Do — and older empty instances repair the missing board automatically.

Owners can see that first look without a second deployment: **Enter demo preview** on the Admin overview swaps the workspace for the demo fixtures in their browser alone, and the demo banner carries the way back out. Nothing touched during a preview reaches the database, and the preview lapses on its own after four hours.

### Project progress at a glance

Projects carry a lifecycle status — Discovery, Queued, Active, Paused, or Complete — so the projects page shows what kind of work is underway without opening every board. Marking a project complete offers to archive it while the wrap-up is top of mind.

### Digests you can review before they send

The Usage page reports Resend's daily and monthly email allowance, recent sends, and color-coded delivery states. Weekday digests appear there 30 minutes before delivery, giving owners time to inspect the exact message, delay it, or cancel it.

## Improved

### A workspace that holds steady

Route changes keep the workspace navigation and header mounted while only the destination page loads, so moving around the app no longer flashes the whole shell. If workspace data cannot load, the app explains the failure and gives a reference instead of repeatedly sending you to your profile as though onboarding were incomplete.

### A footer that finishes the page

The compact footer is no longer a single line. It carries the wordmark, whatever footer links the workspace has configured, social icons, and the credit line beneath a divider — so the quiet treatment still looks finished on sign-in screens and in the demo.

### Notes that read like notes

The notes board presents each note as a finished card: title, formatted text, author, and comment count at a glance. Links written inside a note appear as chips you can follow, alongside the task or project the note became. Opening a note brings up its full text and conversation, and editing happens there too, saved deliberately with **Save note** instead of quietly while you type.

### Onboarding that recovers

First sign-in explains why profile completion is required, remembers the page you were trying to open, and returns you there after saving. If account provisioning is missing instead, the workspace shows its own recovery screen rather than trapping you in a profile redirect.

### One clear visibility choice

Project and category dialogs use one visibility choice. New projects begin with their named owners only, selected groups can collaborate on tasks without becoming project managers, and the Access page manages project and category visibility without opening every group separately.

## Under the hood

### A contract check before the build

Production builds now run a database contract check first, refusing to deploy an app whose database is missing the functions and columns it depends on. Admin reports profile, default-access, signup-trigger, and starter-status health, and owners can repair missing records from there instead of opening the SQL editor.

### Bootstrapping without a seed file

Default statuses and the default access tier are created by the provisioning function rather than by `seed.sql`, so a brand-new deployment reaches a working board without anyone running a seeding step by hand.

### One realtime channel

Every workspace subscriber shared a single Supabase realtime channel instead of opening one per component, which is the difference between a connection count that tracks the number of people in the workspace and one that tracks the number of mounted components.

### Refactors that made the release possible

The task workspace state was decomposed again, client feedback was standardized, and modal footer actions were unified in `@ryanmeetup/ui`, which is what let the calendar, the demo, and project lifecycle statuses land in the same stretch.

## Still in beta

Project and category visibility was reworked again here, the third arrangement in five releases — anyone who had learned the previous model had to learn this one. The demo runs entirely on compiled fixtures, so what it demonstrates is the interface, not a workspace holding real data under real permissions.
