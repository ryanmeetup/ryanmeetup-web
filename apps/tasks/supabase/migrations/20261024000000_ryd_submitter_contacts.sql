-- Each time a reviewer emails someone whose form answers no order claims, one
-- row: the count is how many times they've been asked, the newest row when.
-- Keyed by the submitter's normalized email, since that is all an unmatched
-- response has to go on. Rows outlive a later match; they stay as history.

create table if not exists public.ryd_submitter_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 320),
  contacted_by uuid references public.profiles (id) on delete set null,
  contacted_at timestamptz not null default now()
);

create index if not exists ryd_submitter_contacts_email_idx
  on public.ryd_submitter_contacts (email, contacted_at desc);

alter table public.ryd_submitter_contacts enable row level security;

revoke all on table public.ryd_submitter_contacts from anon, authenticated;

grant select, insert, update, delete on table public.ryd_submitter_contacts
  to service_role;
