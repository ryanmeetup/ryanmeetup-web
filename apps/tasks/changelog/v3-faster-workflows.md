---
version: "0.3.0"
slug: v3-faster-workflows
author: Ryan Le
date: "2026-08-09"
dateLabel: August 9, 2026
title: Dashboard, global search, and stable task keys
summary: A real dashboard and activity page, durable RMT-numbered task URLs, global search, saved drafts, and the pagination that had been missing since v0.2.0.
overview:
  - Dashboard and a full workspace activity page
  - Durable RMT task numbers and stable task URLs
  - Global search across the workspace
  - Saved task drafts, richer filters, and pagination
  - Hierarchical category permissions
---

## New

### Dashboard and activity page

Assigned work, reported tasks, upcoming deadlines, and recent movement in one place, instead of reading them off the board by eye.

### Stable task pages and identifiers

Every task carries a generated number and a durable `RMT-###` URL. The link keeps working when the task is renamed, re-filed, or moved to another project, which is what makes a task key worth pasting into a message.

### Global task search

Find a task from anywhere in the workspace and land on either its page or the filtered board that contains it.

### Saved task drafts

Stop partway through creating a task and pick the draft back up from the dashboard.

## Improved

### Filtering and pagination

Filters can include or exclude, multiselect controls replaced single-choice dropdowns, and pagination came back after being pulled in v0.2.0. The filter panel is a shared primitive, so the board, the activity page, and search behave the same way rather than each implementing filtering separately.

### Richer task and project editing

Attachments, reporter details, lateness indicators, comments, and per-profile task view preferences.

### Team and access insights

Owners gained clearer member status, workload context, and more capable access group controls.

## Under the hood

### Permissions that resolve through a hierarchy

Access groups gained a rank, so category permissions resolve through tiers rather than requiring a separate grant for every group against every category. Adding a category no longer means revisiting the whole permission matrix.

### Shared filter and navigation primitives

The include/exclude filter panel and detail navigation were lifted into shared components, so the board, the activity page, and search filter through the same code rather than three implementations of it.

## Still in beta

Search and filtering query the workspace directly on every change, which is fine at this size and will not stay fine. There was still no way to report a problem from inside the app.
