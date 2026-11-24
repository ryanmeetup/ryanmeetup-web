-- RMT only. Anonymous sales and add-to-cart activity per store product, so the
-- storefront can label listings people are actually buying ("Best seller",
-- "Trending") and state rounded, real milestones ("25+ sold this month").
--
-- Rows hold no buyer, customer, cart or order details beyond a dedupe key:
-- a sale's key is its Shopify order and line ID, and a cart add's key carries
-- only a hash of the cart ID, one row per cart per product.

create table if not exists public.store_product_activity (
  id bigint generated always as identity primary key,
  shop_id text not null check (shop_id ~ '^[1-9][0-9]*$'),
  kind text not null check (kind in ('sale', 'cart_add')),
  product_id text not null check (product_id ~ '^[1-9][0-9]{0,19}$'),
  quantity integer not null check (quantity between 1 and 1000),
  source_key text not null check (length(source_key) between 1 and 200),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (shop_id, kind, source_key)
);
create index if not exists store_product_activity_recent
  on public.store_product_activity (shop_id, occurred_at);

alter table public.store_product_activity enable row level security;
revoke all on public.store_product_activity from public, anon, authenticated;
grant select, insert, delete on public.store_product_activity to service_role;

-- Per-product totals over the windows the storefront labels from: units sold in
-- the last 30 and 7 days, the 7 days before that, and since a sale began (null
-- for no sale); and distinct carts that added the product in 24 hours and 7 days.
create or replace function public.store_product_activity_summary(p_shop_id text, p_sale_start timestamptz)
returns table (
  product_id text, sold_30d bigint, sold_7d bigint, sold_prior_7d bigint, sold_in_sale bigint,
  carts_24h bigint, carts_7d bigint
)
language sql stable security invoker set search_path = '' as $$
  select a.product_id,
    coalesce(sum(a.quantity) filter (where a.kind = 'sale' and a.occurred_at >= now() - interval '30 days'), 0)::bigint,
    coalesce(sum(a.quantity) filter (where a.kind = 'sale' and a.occurred_at >= now() - interval '7 days'), 0)::bigint,
    coalesce(sum(a.quantity) filter (where a.kind = 'sale' and a.occurred_at >= now() - interval '14 days'
      and a.occurred_at < now() - interval '7 days'), 0)::bigint,
    coalesce(sum(a.quantity) filter (where a.kind = 'sale' and p_sale_start is not null and a.occurred_at >= p_sale_start), 0)::bigint,
    count(*) filter (where a.kind = 'cart_add' and a.occurred_at >= now() - interval '24 hours'),
    count(*) filter (where a.kind = 'cart_add' and a.occurred_at >= now() - interval '7 days')
  from public.store_product_activity a
  where a.shop_id = p_shop_id
    and a.occurred_at >= least(now() - interval '30 days', coalesce(p_sale_start, now()))
  group by a.product_id;
$$;

revoke all on function public.store_product_activity_summary(text, timestamptz) from public, anon, authenticated;
grant execute on function public.store_product_activity_summary(text, timestamptz) to service_role;

notify pgrst, 'reload schema';
