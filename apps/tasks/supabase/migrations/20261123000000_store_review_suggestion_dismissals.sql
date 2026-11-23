-- RMT only. Dismissing a purchase hides its reminder until restored; it never
-- disables reviews, affects another purchase, or changes email preferences.
create table if not exists public.store_review_suggestion_dismissals (
  shop_id text not null check (shop_id ~ '^[1-9][0-9]*$'),
  customer_subject text not null check (length(customer_subject) between 1 and 512),
  line_id text not null check (line_id ~ '^[1-9][0-9]{0,19}$'),
  dismissed_at timestamptz not null default now(),
  primary key (shop_id, customer_subject, line_id)
);

alter table public.store_review_suggestion_dismissals enable row level security;
revoke all on public.store_review_suggestion_dismissals from public, anon, authenticated;
grant select, insert, delete on public.store_review_suggestion_dismissals to service_role;

comment on table public.store_review_suggestion_dismissals is
  'Private, account-scoped purchase reminder dismissals. Review eligibility is independent.';
