---
version: "0.4.0"
slug: v4-workspace-grows-up
author: Ryan Le
date: "2026-08-14"
dateLabel: August 12–14, 2026
title: Notes, contacts, and the refactor that made room for them
summary: Two new resource types landed on top of a task workspace that had to be taken apart first — plus workspace-wide activity, category owners, a responsive pass, and this changelog.
overview:
  - Quick notes that can be converted into tasks
  - Contact management for people and organizations
  - Favorite projects and a masonry dashboard
  - Workspace-wide activity beyond tasks
  - The task workspace client decomposed into domain modules
---

## New

### Notes that can become tasks

Capture a thought, file it under a category, and convert it into real work when it is ready.

### Contact management

People, organizations, and the context around them live next to the work instead of in a separate address book.

### Favorite projects

Star the projects you visit constantly and reach them from the dashboard and the sidebar.

## Improved

### Safer task edits

Changing one field on a task stopped resetting the fields you had not touched, a bug that had been true since v0.1.0.

### A more useful dashboard

A responsive masonry layout groups assigned work, drafts, deadlines, favorites, and activity instead of stacking them in one column.

### Category access and ownership

Categories gained explicit owners and readable visibility, so responsibility for a category is a recorded fact rather than a convention.

### Responsive workspace navigation

Navigation, forms, cards, and task columns were reworked for phones and tablets as well as wide desktops.

## Under the hood

### Decomposing the workspace client

The task workspace had grown into one component holding most of the app's state. It was split into domain modules — workspace loading, task state, resource attachments, interaction hooks — which is what let notes and contacts reuse the loading, editing, and activity behavior the board already had instead of reimplementing it.

### Activity beyond tasks

Activity stopped being task-only. Projects, categories, notes, contacts, and attachments record their own history, written by the API alongside each change.

### A changelog that lives in the repo

These notes are Markdown files with frontmatter, parsed at build time, so a release note ships in the same change as the work it describes.

## Still in beta

Activity was written by the API next to each change, not by the database, so a change that succeeded while its history failed left the two disagreeing. It stayed that way until v0.7.0 put both in one transaction. Notes and contacts shipped with no access controls of their own — everyone in the workspace could read both, and locking them down took until v0.7.0.
