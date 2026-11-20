-- RMT only. Read the newest published reviews across the shop without widening
-- the product-scoped reader or exposing private review records to a browser.
create index if not exists store_reviews_latest_public
  on public.store_reviews (shop_id, first_published_at desc, id desc)
  where state = 'active' and approved_revision_id is not null;

create or replace function public.store_latest_reviews(p_shop_id text)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  with latest_products as (
    select product_id from public.store_reviews
    where shop_id = p_shop_id and state = 'active' and approved_revision_id is not null
    order by first_published_at desc, id desc limit 6
  )
  -- Reuse the canonical public projection, including independently approved
  -- photos and public replies. No rating filter or featured-review selection.
  select * from public.store_public_reviews(p_shop_id, array(select product_id from latest_products), 6);
$$;

revoke all on function public.store_latest_reviews(text) from public, anon, authenticated;
grant execute on function public.store_latest_reviews(text) to service_role;
notify pgrst, 'reload schema';
