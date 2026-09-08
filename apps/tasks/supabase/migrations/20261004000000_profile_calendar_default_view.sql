-- Per-person default source for the Calendar's Show menu.
--
-- The two Tasks deployments have separate profile rows, so this preference can
-- intentionally differ between them. Existing profiles keep the calendar's
-- current behavior and start on every available source.
--
-- The baseline carries the same column for a build from empty.

alter table public.profiles
  add column if not exists calendar_default_view text not null default 'all';

alter table public.profiles
  drop constraint if exists profiles_calendar_default_view_check,
  add constraint profiles_calendar_default_view_check
    check (calendar_default_view in ('all', 'task', 'away', 'important', 'google'));

comment on column public.profiles.calendar_default_view is
  'Source selected when this profile opens Calendar: all, task, away, important, or google.';
