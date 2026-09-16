---
version: "0.8.1"
slug: v8-1-reliability-pass
author: Ryan Le
date: "2026-09-14"
dateLabel: September 14, 2026
title: More accurate project history and steadier preferences
summary: A contained reliability release fixed misleading project activity, stale profile preferences, and due-date language on completed projects while keeping the framework dependencies aligned.
overview:
  - Project activity names the fields that actually changed
  - Unchanged access settings no longer create false history
  - Saved profile preferences take effect immediately
  - Completed projects no longer count down toward old due dates
  - Next.js dependencies aligned on one patch version
---

## Fixed

### Project history says what happened

Project activity now names status, date, name, description, and link changes. Saving a project no longer claims its access became restricted when that setting was already selected.

### Current state stays current

Profile preferences take effect as soon as they are saved rather than waiting for another load. Completed projects stop describing their dates as an approaching deadline, so a finished timeline reads as history instead of unfinished work.

## Under the hood

The Tasks app's Next.js packages now use the same patch release, avoiding a mixed framework toolchain between development and production builds.

