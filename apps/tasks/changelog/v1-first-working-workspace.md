---
version: "0.1.0"
slug: v1-first-working-workspace
author: Ryan Le
date: "2026-08-02"
dateLabel: August 1–2, 2026
title: A task board on Next.js and Supabase
summary: The first working board — the Next.js App Router in front, Supabase Postgres and Auth behind it, and the first components pulled out into a shared package.
overview:
  - Task board and workspace on the Next.js App Router
  - Supabase Auth sign-in, profiles, and light and dark themes
  - Projects, categories, and configurable statuses stored in Postgres
  - First components extracted into the shared @ryanmeetup/ui package
---

## New

### The board

Ryan Meetup tasks, statuses, and everyday planning moved out of a spreadsheet and into one app. Statuses are rows in Postgres rather than a hardcoded list, so the columns on the board have been workspace data since the first day rather than something only a deploy can change.

### Sign-in and profiles

Supabase Auth handles sign-in and sessions. A profile row is the workspace identity that everything else points at — assignment, reporting, and, later, ownership.

### Projects, categories, and task details

Tasks could be filed under the projects and work categories the team already used, and the first task editor added the fields the board needed to be more than a list.

## Improved

### Login, theme, and feedback

Light and dark themes, a clearer sign-in screen, and one standard success and error treatment instead of a different message style on every page.

## Under the hood

### A shared UI package

Buttons, pills, cards, and layout primitives started moving into `@ryanmeetup/ui` inside the monorepo, so the Tasks app and the public site draw from the same components instead of drifting apart.

### The first server-side writes

Status changes were the first mutations moved off the client and behind the server, which set the pattern the next release generalized to everything else.

## Still in beta

There were no access controls of any kind. Anyone signed in could read and change everything in the workspace, including tasks that had nothing to do with them.
