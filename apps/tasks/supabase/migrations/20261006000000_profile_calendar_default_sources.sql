-- Let each person choose any non-empty combination of Calendar sources.
-- Existing "all" preferences become all four sources; a single-source
-- preference remains that same source inside an array.

alter table public.profiles
  drop constraint if exists profiles_calendar_default_view_check;

alter table public.profiles
  alter column calendar_default_view drop default,
  alter column calendar_default_view type text[]
    using case
      when calendar_default_view = 'all'
        then array['task', 'away', 'important', 'google']::text[]
      else array[calendar_default_view]::text[]
    end,
  alter column calendar_default_view
    set default array['task', 'away', 'important', 'google']::text[];

alter table public.profiles
  add constraint profiles_calendar_default_view_check check (
    cardinality(calendar_default_view) between 1 and 4
    and calendar_default_view <@ array['task', 'away', 'important', 'google']::text[]
  );

comment on column public.profiles.calendar_default_view is
  'Sources selected when this profile opens Calendar: task, away, important, and/or google.';
