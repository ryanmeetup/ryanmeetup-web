-- RMT only. Page through every published review across the shop, newest
-- first, for the storefront's /reviews page. Uses the same keyset as product
-- pages and the partial index from store_latest_reviews.
create or replace function public.store_review_feed(
  p_shop_id text, p_limit integer,
  p_after_published_at timestamptz default null, p_after_id uuid default null
) returns setof jsonb language sql stable security invoker set search_path = '' as $$
  with page_products as (
    select distinct product_id from (
      select product_id from public.store_reviews
      where shop_id = p_shop_id and state = 'active' and approved_revision_id is not null
        and (p_after_published_at is null or (first_published_at, id) < (p_after_published_at, p_after_id))
      order by first_published_at desc, id desc
      limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) page
  )
  -- The newest rows among this page's products, after the same cursor, are
  -- exactly this page's rows. Reusing the canonical public projection keeps
  -- approved-only text, independently approved photos and replies identical.
  select * from public.store_public_reviews(p_shop_id, array(select product_id from page_products),
    p_limit, p_after_published_at, p_after_id);
$$;

revoke all on function public.store_review_feed(text, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.store_review_feed(text, integer, timestamptz, uuid) to service_role;
notify pgrst, 'reload schema';
