-- RY-D reads the RY-dentification form itself, through the Google Forms API,
-- rather than its response spreadsheet. The form's link never changes while
-- its questions do, and the form already knows which sheet it writes to, so
-- the setting is the form and the sheet is found from it.
--
-- Pairings made against sheet rows (keyed by email and timestamp) cannot be
-- carried over to response IDs. The page shipped a day earlier with Google not
-- yet connected on either instance, so there are none to keep; any that do
-- exist would show as "no longer in the form" and can be linked again.

alter table public.ryd_settings
  add column if not exists form_id text
    check (form_id ~ '^[A-Za-z0-9_-]{20,}$');

alter table public.ryd_settings
  drop column if exists form_sheet_id;
