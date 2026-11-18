-- Store review content, RMT only. Mirrors the @ryanmeetup/reviews content
-- contract: one review per purchased order line, revisions so an edit waits
-- for approval while the approved version stays public, one official reply,
-- and an audit trail. Only the backend service role can reach any of it; the
-- public read functions build exactly the fields a browser may see.

create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null check (shop_id ~ '^[1-9][0-9]*$'),
  -- The Shopify customer subject from the verified session; owns the review.
  customer_subject text not null check (length(customer_subject) between 1 and 512),
  order_id text not null check (order_id ~ '^[1-9][0-9]{0,19}$'),
  line_id text not null check (line_id ~ '^[1-9][0-9]{0,19}$'),
  product_id text not null check (product_id ~ '^[1-9][0-9]{0,19}$'),
  variant_id text check (variant_id is null or variant_id ~ '^[1-9][0-9]{0,19}$'),
  -- Display snapshot of what was bought, kept if the product is renamed.
  product_title text not null check (char_length(product_title) between 1 and 255),
  variant_title text check (variant_title is null or char_length(variant_title) between 1 and 255),
  -- active: shown once approved. hidden: removed by staff. withdrawn: removed by the buyer.
  state text not null default 'active' check (state in ('active', 'hidden', 'withdrawn')),
  approved_revision_id uuid,
  first_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, order_id, line_id),
  check (state <> 'withdrawn' or approved_revision_id is null)
);
create index if not exists store_reviews_public
  on public.store_reviews (shop_id, product_id, first_published_at desc, id desc)
  where state = 'active' and approved_revision_id is not null;
create index if not exists store_reviews_buyer on public.store_reviews (shop_id, customer_subject);

create table if not exists public.store_review_revisions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.store_reviews (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or (char_length(title) between 1 and 100 and title = btrim(title))),
  body text not null check (char_length(body) between 1 and 5000 and body = btrim(body)),
  name_style text not null check (name_style in ('full', 'first-initial', 'anonymous')),
  display_name text not null check (char_length(display_name) between 1 and 60 and display_name = btrim(display_name)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text check (decided_by is null or length(decided_by) between 1 and 200),
  check ((status = 'pending') = (decided_at is null))
);
create unique index if not exists store_review_revisions_one_pending
  on public.store_review_revisions (review_id) where status = 'pending';
create index if not exists store_review_revisions_history
  on public.store_review_revisions (review_id, submitted_at);

do $$ begin
  alter table public.store_reviews add constraint store_reviews_approved_revision_fkey
    foreign key (approved_revision_id) references public.store_review_revisions (id) deferrable initially deferred;
exception when duplicate_object then null; end $$;

create table if not exists public.store_review_replies (
  review_id uuid primary key references public.store_reviews (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000 and body = btrim(body)),
  author text not null check (length(author) between 1 and 200),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_review_events (
  id bigint generated always as identity primary key,
  review_id uuid not null references public.store_reviews (id) on delete cascade,
  revision_id uuid references public.store_review_revisions (id) on delete set null,
  action text not null check (action in ('submitted', 'resubmitted', 'edited', 'withdrawn', 'approved', 'rejected', 'hidden', 'restored', 'reply_set', 'reply_removed')),
  actor_kind text not null check (actor_kind in ('buyer', 'staff')),
  actor text not null check (length(actor) between 1 and 512),
  -- Private moderation context; never part of a public read.
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists store_review_events_review on public.store_review_events (review_id, created_at);

alter table public.store_reviews enable row level security;
alter table public.store_review_revisions enable row level security;
alter table public.store_review_replies enable row level security;
alter table public.store_review_events enable row level security;
revoke all on public.store_reviews, public.store_review_revisions, public.store_review_replies, public.store_review_events
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.store_reviews, public.store_review_revisions, public.store_review_replies, public.store_review_events to service_role;

-- --- buyer writes -------------------------------------------------------------

-- Creates the review for a verified purchased line, or reports what already
-- exists, so a retry never makes a second record. A withdrawn review is
-- resubmitted through the same record and waits for approval again.
create or replace function public.store_submit_review(
  p_shop_id text, p_subject text, p_order_id text, p_line_id text,
  p_product_id text, p_variant_id text, p_product_title text, p_variant_title text,
  p_rating smallint, p_title text, p_body text, p_name_style text, p_display_name text
) returns table (review_id uuid, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_review public.store_reviews;
  v_revision uuid;
begin
  insert into public.store_reviews (shop_id, customer_subject, order_id, line_id, product_id, variant_id, product_title, variant_title)
  values (p_shop_id, p_subject, p_order_id, p_line_id, p_product_id, p_variant_id, p_product_title, p_variant_title)
  on conflict (shop_id, order_id, line_id) do nothing
  returning * into v_review;

  if v_review.id is not null then
    insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name)
    values (v_review.id, p_rating, p_title, p_body, p_name_style, p_display_name) returning id into v_revision;
    insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor)
    values (v_review.id, v_revision, 'submitted', 'buyer', p_subject);
    return query select v_review.id, 'created'::text;
    return;
  end if;

  select r.* into v_review from public.store_reviews r
  where r.shop_id = p_shop_id and r.order_id = p_order_id and r.line_id = p_line_id
  for update;
  if v_review.customer_subject <> p_subject then
    return query select null::uuid, 'forbidden'::text;
    return;
  end if;
  if v_review.state <> 'withdrawn' then
    return query select v_review.id, 'exists'::text;
    return;
  end if;

  update public.store_reviews r set state = 'active', updated_at = clock_timestamp() where r.id = v_review.id;
  insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name)
  values (v_review.id, p_rating, p_title, p_body, p_name_style, p_display_name) returning id into v_revision;
  insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor)
  values (v_review.id, v_revision, 'resubmitted', 'buyer', p_subject);
  return query select v_review.id, 'resubmitted'::text;
end;
$$;

-- An edit replaces any earlier pending edit; the approved version stays public
-- until staff approve the new one. Returns pending, closed, or not_found.
create or replace function public.store_edit_review(
  p_review_id uuid, p_shop_id text, p_subject text,
  p_rating smallint, p_title text, p_body text, p_name_style text, p_display_name text
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  v_state text;
  v_revision uuid;
begin
  select r.state into v_state from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id and r.customer_subject = p_subject
  for update;
  if not found then return 'not_found'; end if;
  if v_state <> 'active' then return 'closed'; end if;

  update public.store_review_revisions v set status = 'superseded', decided_at = clock_timestamp()
  where v.review_id = p_review_id and v.status = 'pending';
  insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name)
  values (p_review_id, p_rating, p_title, p_body, p_name_style, p_display_name) returning id into v_revision;
  update public.store_reviews r set updated_at = clock_timestamp() where r.id = p_review_id;
  insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor)
  values (p_review_id, v_revision, 'edited', 'buyer', p_subject);
  return 'pending';
end;
$$;

-- Withdrawal takes the review off the storefront and out of its totals at once.
create or replace function public.store_withdraw_review(p_review_id uuid, p_shop_id text, p_subject text)
returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.store_reviews r set state = 'withdrawn', approved_revision_id = null, updated_at = clock_timestamp()
  where r.id = p_review_id and r.shop_id = p_shop_id and r.customer_subject = p_subject and r.state <> 'withdrawn';
  if not found then return false; end if;
  update public.store_review_revisions v set status = 'superseded', decided_at = coalesce(v.decided_at, clock_timestamp())
  where v.review_id = p_review_id and v.status in ('pending', 'approved');
  insert into public.store_review_events (review_id, action, actor_kind, actor)
  values (p_review_id, 'withdrawn', 'buyer', p_subject);
  return true;
end;
$$;

-- --- staff moderation ----------------------------------------------------------

-- Approve or reject one pending revision. Approval makes it the public version
-- and retires the previously approved one. The same rules apply to every rating.
create or replace function public.store_decide_review_revision(
  p_revision_id uuid, p_shop_id text, p_approve boolean, p_actor text, p_note text default null
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_review uuid;
  -- Millisecond precision, so a public date round-trips exactly as a page cursor.
  v_now timestamptz := date_trunc('milliseconds', clock_timestamp());
begin
  select v.review_id into v_review from public.store_review_revisions v
  join public.store_reviews r on r.id = v.review_id
  where v.id = p_revision_id and v.status = 'pending' and r.shop_id = p_shop_id and r.state <> 'withdrawn'
  for update of v, r;
  if not found then return false; end if;

  if p_approve then
    update public.store_review_revisions v set status = 'superseded'
    where v.review_id = v_review and v.status = 'approved';
    update public.store_review_revisions v set status = 'approved', decided_at = v_now, decided_by = p_actor where v.id = p_revision_id;
    update public.store_reviews r set approved_revision_id = p_revision_id,
      first_published_at = coalesce(r.first_published_at, v_now), updated_at = v_now
    where r.id = v_review;
  else
    update public.store_review_revisions v set status = 'rejected', decided_at = v_now, decided_by = p_actor where v.id = p_revision_id;
  end if;
  insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor, note)
  values (v_review, p_revision_id, case when p_approve then 'approved' else 'rejected' end, 'staff', p_actor, p_note);
  return true;
end;
$$;

-- Staff can take a review off the storefront (for example, private
-- information) and put it back. A withdrawn review stays the buyer's call.
create or replace function public.store_set_review_hidden(
  p_review_id uuid, p_shop_id text, p_hidden boolean, p_actor text, p_note text default null
) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.store_reviews r set state = case when p_hidden then 'hidden' else 'active' end, updated_at = clock_timestamp()
  where r.id = p_review_id and r.shop_id = p_shop_id and r.state = case when p_hidden then 'active' else 'hidden' end;
  if not found then return false; end if;
  insert into public.store_review_events (review_id, action, actor_kind, actor, note)
  values (p_review_id, case when p_hidden then 'hidden' else 'restored' end, 'staff', p_actor, p_note);
  return true;
end;
$$;

-- Sets, replaces, or (with a null body) removes the one official reply.
create or replace function public.store_set_review_reply(
  p_review_id uuid, p_shop_id text, p_body text, p_actor text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id and r.state <> 'withdrawn' for update;
  if not found then return false; end if;
  if p_body is null then
    delete from public.store_review_replies p where p.review_id = p_review_id;
    if not found then return false; end if;
  else
    insert into public.store_review_replies as p (review_id, body, author)
    values (p_review_id, p_body, p_actor)
    on conflict (review_id) do update set body = excluded.body, author = excluded.author, updated_at = clock_timestamp();
  end if;
  insert into public.store_review_events (review_id, action, actor_kind, actor)
  values (p_review_id, case when p_body is null then 'reply_removed' else 'reply_set' end, 'staff', p_actor);
  return true;
end;
$$;

-- --- public reads --------------------------------------------------------------

create or replace function public.store_review_iso(p_at timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

-- Totals over every published review in scope, independent of paging. The
-- average is sum/count in double precision, matching the contract's check.
create or replace function public.store_review_summary(p_shop_id text, p_product_ids text[])
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with ratings as (
    select v.rating from public.store_reviews r
    join public.store_review_revisions v on v.id = r.approved_revision_id
    where r.shop_id = p_shop_id and r.product_id = any (p_product_ids)
      and r.state = 'active' and r.approved_revision_id is not null
  )
  select jsonb_build_object(
    'count', count(*),
    'average', case when count(*) = 0 then 0 else sum(rating)::float8 / count(*)::float8 end,
    'distribution', jsonb_build_object(
      '1', count(*) filter (where rating = 1), '2', count(*) filter (where rating = 2),
      '3', count(*) filter (where rating = 3), '4', count(*) filter (where rating = 4),
      '5', count(*) filter (where rating = 5)))
  from ratings;
$$;

-- One page of published reviews, newest first, each shaped exactly like the
-- contract's PublicReview. Page with the last row's publishedAt and id.
create or replace function public.store_public_reviews(
  p_shop_id text, p_product_ids text[], p_limit integer,
  p_after_published_at timestamptz default null, p_after_id uuid default null
) returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id,
    'rating', v.rating,
    'title', v.title,
    'body', v.body,
    'displayName', v.display_name,
    'publishedAt', public.store_review_iso(r.first_published_at),
    'editedAt', case when v.decided_at > r.first_published_at then public.store_review_iso(v.decided_at) end,
    'item', jsonb_build_object('productId', r.product_id, 'productTitle', r.product_title, 'variantTitle', r.variant_title),
    -- Every review here was written against a verified purchased line.
    'verifiedPurchase', true,
    'photos', '[]'::jsonb,
    'reply', case when p.review_id is null then null
      else jsonb_build_object('body', p.body, 'publishedAt', public.store_review_iso(p.published_at)) end
  )
  from public.store_reviews r
  join public.store_review_revisions v on v.id = r.approved_revision_id
  left join public.store_review_replies p on p.review_id = r.id
  where r.shop_id = p_shop_id and r.product_id = any (p_product_ids)
    and r.state = 'active' and r.approved_revision_id is not null
    and (p_after_published_at is null or (r.first_published_at, r.id) < (p_after_published_at, p_after_id))
  order by r.first_published_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function
  public.store_submit_review(text,text,text,text,text,text,text,text,smallint,text,text,text,text),
  public.store_edit_review(uuid,text,text,smallint,text,text,text,text),
  public.store_withdraw_review(uuid,text,text),
  public.store_decide_review_revision(uuid,text,boolean,text,text),
  public.store_set_review_hidden(uuid,text,boolean,text,text),
  public.store_set_review_reply(uuid,text,text,text),
  public.store_review_iso(timestamptz),
  public.store_review_summary(text,text[]),
  public.store_public_reviews(text,text[],integer,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function
  public.store_submit_review(text,text,text,text,text,text,text,text,smallint,text,text,text,text),
  public.store_edit_review(uuid,text,text,smallint,text,text,text,text),
  public.store_withdraw_review(uuid,text,text),
  public.store_decide_review_revision(uuid,text,boolean,text,text),
  public.store_set_review_hidden(uuid,text,boolean,text,text),
  public.store_set_review_reply(uuid,text,text,text),
  public.store_review_iso(timestamptz),
  public.store_review_summary(text,text[]),
  public.store_public_reviews(text,text[],integer,timestamptz,uuid)
  to service_role;
notify pgrst, 'reload schema';
