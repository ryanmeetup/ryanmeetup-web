-- RMT only. A null product list now summarizes every published review in the
-- shop, for the store-wide rating on /reviews. That includes Etsy reviews whose
-- listing never came to the store, which no product list can name.
--
-- Same rows, rounding and shape as 20261121140000 for any non-null list. Under
-- the previous body a null list matched nothing and returned a zero count, so
-- code that lands before this migration simply shows no store-wide rating.

create or replace function public.store_review_summary(p_shop_id text, p_product_ids text[])
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with ratings as (
    select v.rating, ceil(v.rating)::int as star from public.store_reviews r
    join public.store_review_revisions v on v.id = r.approved_revision_id
    where r.shop_id = p_shop_id and (p_product_ids is null or r.product_id = any (p_product_ids))
      and r.state = 'active' and r.approved_revision_id is not null
  )
  select jsonb_build_object(
    'count', count(*),
    'average', case when count(*) = 0 then 0 else sum(rating)::float8 / count(*)::float8 end,
    'distribution', jsonb_build_object(
      '1', count(*) filter (where star = 1), '2', count(*) filter (where star = 2),
      '3', count(*) filter (where star = 3), '4', count(*) filter (where star = 4),
      '5', count(*) filter (where star = 5)))
  from ratings;
$$;

revoke all on function public.store_review_summary(text,text[]) from public, anon, authenticated;
grant execute on function public.store_review_summary(text,text[]) to service_role;

notify pgrst, 'reload schema';
