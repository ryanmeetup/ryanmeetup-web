-- Form responses a reviewer has set aside, usually a buyer's duplicate
-- submission. The Google Forms API can read responses but not delete them, so
-- the response stays in the form and RY-D stops offering it. Restoring one
-- deletes its row here.

create table if not exists public.ryd_dismissed_submissions (
  -- The form's response ID, as in ryd_order_submissions.
  submission_key text primary key check (char_length(submission_key) between 3 and 400),
  dismissed_by uuid not null references public.profiles (id) on delete restrict,
  dismissed_at timestamptz not null default now()
);

alter table public.ryd_dismissed_submissions enable row level security;

revoke all on table public.ryd_dismissed_submissions from anon, authenticated;

grant select, insert, update, delete on table public.ryd_dismissed_submissions
  to service_role;
