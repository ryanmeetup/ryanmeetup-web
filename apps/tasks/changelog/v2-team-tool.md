---
version: "0.2.0"
slug: v2-team-tool
author: Ryan Le
date: "2026-08-05"
dateLabel: August 3–5, 2026
title: Access groups, fail-closed authorization, and the first tests
summary: The workspace stopped trusting the browser. Project access moved into groups, authorization was rewritten to deny by default, every write was pushed behind a canonical boundary, and the first permissions suite arrived to keep it that way.
overview:
  - Profile onboarding and password recovery
  - Project access granted through centralized access groups
  - Fail-closed authorization and canonical mutation boundaries
  - Access preview — see the workspace as a group or a member sees it
  - The first permissions and workflow test suite
---

## New

### Onboarding and profile preferences

Teammates get a guided profile setup and a password recovery path, so a second person could sign in without an invitation being hand-assembled.

### Access groups instead of one-off grants

Projects are shared through access groups rather than per-person permissions. A creator's groups are granted automatically, and owners are managed in one place instead of per project.

### Access preview

Owners can load the workspace as a group or a member sees it before changing anyone's permissions — the difference between reasoning about a policy and reading its result.

## Improved

### Workspace navigation and management

Projects, categories, statuses, profile controls, and filtered board links became reachable from where you already are, rather than through the settings pages.

### Board and status workflows

Task movement, shared updates, status configuration, and activity presentation stopped depending on which screen the change started from.

## Under the hood

### Deny by default

Project authorization was rewritten to fail closed: a request that cannot prove access is refused rather than falling through to a permissive branch. Privileged API routes were pulled behind explicit boundaries, and writes now travel one canonical mutation path instead of a component reaching for the database client on its own.

### Recoverable writes

Task and attachment writes were made recoverable, so a half-finished save reports a failure instead of leaving a task without the attachment it was supposed to carry.

### Browser and origin hardening

Security headers, an allowlist of accepted request origins, and an auth error path that redirects to sign-in rather than throwing into a blank page.

### The first tests

A permissions and core-workflow suite landed alongside upgraded test tooling, so a change that breaks access control fails a check rather than reaching the workspace.

## Still in beta

Task pagination was pulled back out at the end of this stretch, so the board loaded every task in the workspace on every visit until v0.3.0 restored it. Access groups arrived before there was any way to see their effect on a specific person beyond the preview, so a wrong grant was easier to make than to notice.
