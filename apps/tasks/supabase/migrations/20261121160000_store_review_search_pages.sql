-- RMT only. Numbered, server-filtered pages of published reviews.
--
-- With the Etsy import the shop holds a few hundred published reviews, and the
-- storefront used to filter, sort and search them in the browser after walking
-- every keyset page. `store_public_review_search` does that work here instead:
-- one call returns a page of matches, the total, and where that page starts.
--
-- `p_product_ids` scopes the read to a product page; null reads the whole shop.
-- `p_focus_id` asks for the page that holds one review (a permalink); when it
-- does not match, `p_offset` decides. An offset past the end returns the last
-- page, so a stale link still lands on reviews. The returned `offset` says
-- which page was served.
--
-- Rows use the same approved-only projection as product pages and the feed.
-- That projection moves into `store_public_review_json`, and
-- `store_public_reviews` (product pages, the feed and the home showcase) now
-- reads through it, so no reader can drift from the others.

create or replace function public.store_public_review_json(p_review_id uuid)
returns jsonb
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
    -- Verified only when the review was written against a checked purchased line.
    'verifiedPurchase', r.order_id is not null,
    'source', r.source,
    'photos', coalesce((select jsonb_agg(jsonb_build_object(
      'url', '/api/reviews/media/' || r.id::text || '/' || v.id::text || '/' || photo.id::text,
      'width', photo.width, 'height', photo.height) order by link.position)
      from public.store_review_revision_photos link
      join public.store_review_photo_drafts photo on photo.id = link.photo_id and photo.attached_review_id = r.id
        and photo.shop_id = r.shop_id and photo.customer_subject = r.customer_subject and photo.product_id = r.product_id and photo.state = 'attached'
      where link.revision_id = v.id and link.moderation_state = 'approved'), '[]'::jsonb),
    'reply', case when p.review_id is null then null
      else jsonb_build_object('body', p.body, 'publishedAt', public.store_review_iso(p.published_at)) end
  )
  from public.store_reviews r
  join public.store_review_revisions v on v.id = r.approved_revision_id
  left join public.store_review_replies p on p.review_id = r.id
  where r.id = p_review_id and r.state = 'active' and r.approved_revision_id is not null;
$$;

-- Same rows, order and limits as 20261121150000; the projection is now shared.
create or replace function public.store_public_reviews(
  p_shop_id text, p_product_ids text[], p_limit integer,
  p_after_published_at timestamptz default null, p_after_id uuid default null
) returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select public.store_public_review_json(r.id)
  from public.store_reviews r
  where r.shop_id = p_shop_id and r.product_id = any (p_product_ids)
    and r.state = 'active' and r.approved_revision_id is not null
    and (p_after_published_at is null or (r.first_published_at, r.id) < (p_after_published_at, p_after_id))
  order by r.first_published_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.store_public_review_search(
  p_shop_id text, p_product_ids text[], p_rating integer, p_source text, p_sort text, p_query text,
  p_limit integer, p_offset integer, p_focus_id uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  -- Matches the storefront's text search: the trimmed, lower-cased phrase anywhere in the review.
  v_needle text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_result jsonb;
begin
  if p_shop_id is null
    or (p_product_ids is not null and cardinality(p_product_ids) not between 1 and 50)
    or (p_rating is not null and p_rating not between 1 and 5)
    or (p_source is not null and p_source not in ('verified', 'etsy', 'unmatched'))
    or p_sort is null or p_sort not in ('newest', 'oldest', 'highest', 'lowest')
    or char_length(coalesce(p_query, '')) > 200
    or p_offset is null or p_offset not between 0 and 100000 then
    raise exception 'Invalid review search' using errcode = '22023';
  end if;

  with matches as (
    select r.id, (row_number() over (order by
      case when p_sort = 'highest' then v.rating end desc nulls last,
      case when p_sort = 'lowest' then v.rating end asc nulls last,
      case when p_sort = 'oldest' then r.first_published_at end asc nulls last,
      case when p_sort = 'oldest' then r.id end asc nulls last,
      r.first_published_at desc, r.id desc) - 1)::integer as position
    from public.store_reviews r
    join public.store_review_revisions v on v.id = r.approved_revision_id
    where r.shop_id = p_shop_id
      and (p_product_ids is null or r.product_id = any (p_product_ids))
      and r.state = 'active' and r.approved_revision_id is not null
      -- Star buckets match the storefront: 4.5 and 5 are both five stars.
      and (p_rating is null or ceil(v.rating) = p_rating)
      and case p_source
        when 'verified' then r.order_id is not null
        when 'etsy' then r.source = 'etsy'
        when 'unmatched' then r.source = 'store' and r.order_id is null
        else true end
      and (v_needle is null or strpos(lower(concat_ws(' ', v.title, v.body, v.display_name, r.product_title)), v_needle) > 0)
  ),
  bounds as (
    select count(*)::integer as total, (select m.position from matches m where m.id = p_focus_id) as focus from matches
  ),
  page as (
    select b.total, case
      when b.focus is not null then b.focus / v_limit * v_limit
      when b.total = 0 then 0
      else least(p_offset, (b.total - 1) / v_limit * v_limit) end as start
    from bounds b
  )
  select jsonb_build_object('total', pg.total, 'offset', pg.start, 'reviews', coalesce((
    select jsonb_agg(public.store_public_review_json(m.id) order by m.position)
    from matches m where m.position >= pg.start and m.position < pg.start + v_limit), '[]'::jsonb))
  into v_result
  from page pg;
  return v_result;
end;
$$;

revoke all on function public.store_public_review_json(uuid) from public, anon, authenticated;
revoke all on function public.store_public_review_search(text,text[],integer,text,text,text,integer,integer,uuid)
  from public, anon, authenticated;
grant execute on function public.store_public_review_json(uuid) to service_role;
grant execute on function public.store_public_review_search(text,text[],integer,text,text,text,integer,integer,uuid)
  to service_role;
notify pgrst, 'reload schema';
