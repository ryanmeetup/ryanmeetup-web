-- RY-D verification: a rolling queue of fulfillment orders, the decisions made
-- on them, and the batches sent back to fulfillment.
--
-- Ryan Meetup sells RY-Ds; the second instance does not. Both databases get
-- these tables so the schema never drifts, and `instance_settings.ryd_enabled`
-- (null, so off, by default) decides whether the page exists at all.
--
-- Form submissions are deliberately not stored. They are read live from the
-- RY-dentification sheet in Google, so the uploads and social links people
-- sent stay where they put them. Only the pairing (an email plus a form
-- timestamp) is kept here.
--
-- Every table is reached through the service role after the route has checked
-- the instance flag and `can_view_workspace_area('ryd')`. RLS is enabled with
-- no policies, so the user client reads nothing even if a grant is added later.

alter table public.instance_settings
  add column if not exists ryd_enabled boolean;

-- Where the form lives and where the finished CSV goes. A singleton, like
-- `instance_settings`, edited by owners from the RY-D page.
create table if not exists public.ryd_settings (
  id boolean primary key default true check (id),
  form_sheet_id text check (form_sheet_id ~ '^[A-Za-z0-9_-]{20,}$'),
  fulfillment_email text check (
    fulfillment_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  ),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- The Google account that owns the form, with Sheets and Drive read access.
-- Separate from the Calendar connection: the form's owner and the calendar's
-- owner are often different accounts, and the scopes differ.
create table if not exists public.ryd_google_integrations (
  id text primary key check (id = 'ryd_google'),
  encrypted_refresh_token text not null,
  account_email text not null,
  connected_by uuid not null references public.profiles (id) on delete restrict,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ryd_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null check (char_length(filename) between 1 and 255),
  headers jsonb not null check (jsonb_typeof(headers) = 'array'),
  row_count integer not null check (row_count >= 0),
  new_count integer not null check (new_count >= 0),
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.ryd_fulfillment_batches (
  id uuid primary key default gen_random_uuid(),
  recipient text,
  order_count integer not null check (order_count >= 0),
  verified_count integer not null check (verified_count >= 0),
  sent_by uuid not null references public.profiles (id) on delete restrict,
  sent_at timestamptz not null default now()
);

create table if not exists public.ryd_orders (
  order_id text primary key check (char_length(order_id) between 1 and 64),
  sales_order text not null default '',
  ordered_at text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  contact_method text not null default '',
  -- The row exactly as fulfillment sent it, keyed by header, so the CSV that
  -- goes back is their file with one column changed.
  raw jsonb not null check (jsonb_typeof(raw) = 'object'),
  first_import_id uuid not null references public.ryd_imports (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'needs_info', 'rejected')),
  note text check (char_length(note) <= 2000),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  -- The batch that told fulfillment this order is cleared. An order leaves the
  -- export once it has been sent as verified.
  cleared_batch_id uuid references public.ryd_fulfillment_batches (id) on delete set null,
  last_emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ryd_orders_status_idx on public.ryd_orders (status);
create index if not exists ryd_orders_email_idx on public.ryd_orders (email);

create table if not exists public.ryd_order_submissions (
  order_id text not null references public.ryd_orders (order_id) on delete cascade,
  -- Normalized email plus form timestamp; see lib/ryd/matching.ts.
  submission_key text not null check (char_length(submission_key) between 3 and 400),
  source text not null check (source in ('suggested', 'manual')),
  linked_by uuid not null references public.profiles (id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (order_id, submission_key)
);

create index if not exists ryd_order_submissions_key_idx
  on public.ryd_order_submissions (submission_key);

create table if not exists public.ryd_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.ryd_orders (order_id) on delete cascade,
  action text not null check (
    action in ('imported', 'status', 'note', 'linked', 'unlinked', 'emailed', 'sent')
  ),
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ryd_order_events_order_idx
  on public.ryd_order_events (order_id, created_at desc);

alter table public.ryd_settings enable row level security;
alter table public.ryd_google_integrations enable row level security;
alter table public.ryd_imports enable row level security;
alter table public.ryd_fulfillment_batches enable row level security;
alter table public.ryd_orders enable row level security;
alter table public.ryd_order_submissions enable row level security;
alter table public.ryd_order_events enable row level security;

revoke all on table
  public.ryd_settings,
  public.ryd_google_integrations,
  public.ryd_imports,
  public.ryd_fulfillment_batches,
  public.ryd_orders,
  public.ryd_order_submissions,
  public.ryd_order_events
  from anon, authenticated;

grant select, insert, update, delete on table
  public.ryd_settings,
  public.ryd_google_integrations,
  public.ryd_imports,
  public.ryd_fulfillment_batches,
  public.ryd_orders,
  public.ryd_order_submissions,
  public.ryd_order_events
  to service_role;

-- Customer names, emails, and identity evidence: the page starts closed to
-- everyone but owners, who open it to an access group from /admin/access.
insert into public.workspace_area_access (area, access_mode)
values ('ryd', 'restricted')
on conflict (area) do nothing;
