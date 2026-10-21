# PRD: restore the missing RY-D submitter-contact table

Run both SQL blocks below in the **PRD** Supabase dashboard SQL Editor for
`projects.ryanle.dev` (project `vjsnobmfsfrsnwukfaoq`). RMT already has this
table and does not need this repair.

PRD's reported contract result has six failures: the missing table, its four
columns, and its primary key. They all come from the absent
`20261024000000_ryd_submitter_contacts.sql` migration. Recording the later
contract migration does not install earlier migrations.

This block copies that committed migration in full, records its version, and
reloads the API schema. It is safe to run again and preserves existing rows.

```sql
begin;

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

insert into supabase_migrations.schema_migrations(version,name,statements)
values ('20261024000000','ryd_submitter_contacts',array['-- Applied from the committed dashboard handoff.'])
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
```

Then run this verification block on **PRD**:

```sql
select public.ryd_contract_health() as health,
  exists(select 1 from supabase_migrations.schema_migrations where version='20261024000000') as contacts_migration_recorded,
  exists(select 1 from supabase_migrations.schema_migrations where version='20261101000000') as migration_recorded;
```

Expected: one row with `health = {"contractOk": true, "failures": []}` and
both migration values `true`. Keep the normal build preflight enabled.
