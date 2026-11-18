-- RMT only. A signed-in buyer without a matching order may still review a
-- product: one unverified review per buyer and product, with no order line.
-- Every review still waits for staff approval, and only reviews written
-- against a checked purchased line are shown as verified.

alter table public.store_reviews alter column order_id drop not null;
alter table public.store_reviews alter column line_id drop not null;
alter table public.store_reviews drop constraint if exists store_reviews_purchase_pair;
alter table public.store_reviews add constraint store_reviews_purchase_pair check ((order_id is null) = (line_id is null));
-- Verified reviews stay one per order line through the existing unique key;
-- NULLs never collide there, so unverified reviews get their own limit.
create unique index if not exists store_reviews_one_unverified
  on public.store_reviews (shop_id, customer_subject, product_id) where order_id is null;

-- Same outcomes as before. A null order and line writes the buyer's single
-- unverified review of the product; a withdrawn one can be resubmitted.
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
  if (p_order_id is null) <> (p_line_id is null) then
    raise exception 'Order and line go together' using errcode = '22023';
  end if;

  if p_order_id is null then
    insert into public.store_reviews (shop_id, customer_subject, order_id, line_id, product_id, variant_id, product_title, variant_title)
    values (p_shop_id, p_subject, null, null, p_product_id, null, p_product_title, null)
    on conflict (shop_id, customer_subject, product_id) where order_id is null do nothing
    returning * into v_review;
  else
    insert into public.store_reviews (shop_id, customer_subject, order_id, line_id, product_id, variant_id, product_title, variant_title)
    values (p_shop_id, p_subject, p_order_id, p_line_id, p_product_id, p_variant_id, p_product_title, p_variant_title)
    on conflict (shop_id, order_id, line_id) do nothing
    returning * into v_review;
  end if;

  if v_review.id is not null then
    insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name)
    values (v_review.id, p_rating, p_title, p_body, p_name_style, p_display_name) returning id into v_revision;
    insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor)
    values (v_review.id, v_revision, 'submitted', 'buyer', p_subject);
    return query select v_review.id, 'created'::text;
    return;
  end if;

  if p_order_id is null then
    select r.* into v_review from public.store_reviews r
    where r.shop_id = p_shop_id and r.customer_subject = p_subject and r.product_id = p_product_id and r.order_id is null
    for update;
  else
    select r.* into v_review from public.store_reviews r
    where r.shop_id = p_shop_id and r.order_id = p_order_id and r.line_id = p_line_id
    for update;
  end if;
  if v_review.customer_subject <> p_subject then
    return query select null::uuid, 'forbidden'::text;
    return;
  end if;
  if v_review.state <> 'withdrawn' then
    return query select v_review.id, 'exists'::text;
    return;
  end if;

  update public.store_reviews r set state = 'active', first_published_at = null, updated_at = clock_timestamp()
  where r.id = v_review.id;
  insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name)
  values (v_review.id, p_rating, p_title, p_body, p_name_style, p_display_name) returning id into v_revision;
  insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor)
  values (v_review.id, v_revision, 'resubmitted', 'buyer', p_subject);
  return query select v_review.id, 'resubmitted'::text;
end;
$$;

-- The products among p_product_ids this buyer already holds an unverified
-- (and not withdrawn) review for, so the composer can say so.
create or replace function public.store_buyer_reviewed_products(p_shop_id text, p_subject text, p_product_ids text[])
returns setof text language sql stable security invoker set search_path = '' as $$
  select distinct r.product_id from public.store_reviews r
  where r.shop_id = p_shop_id and r.customer_subject = p_subject and r.order_id is null
    and r.state <> 'withdrawn' and r.product_id = any(p_product_ids) order by r.product_id;
$$;

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
    -- Verified only when the review was written against a checked purchased line.
    'verifiedPurchase', r.order_id is not null,
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

-- v3 adds verifiedPurchase. v2 stays unchanged for deployments that still read it.
create or replace function public.store_review_moderation_page_v3(
  p_actor uuid, p_shop_id text, p_filter text, p_limit integer,
  p_after_created_at timestamptz default null, p_after_id uuid default null
) returns setof jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.store_require_review_owner(p_actor);
  if p_filter is null or p_filter not in ('pending', 'published', 'hidden', 'all')
    or (p_after_created_at is null) <> (p_after_id is null) then
    raise exception 'Invalid moderation page' using errcode = '22023';
  end if;
  return query
  select jsonb_build_object(
    'id', r.id, 'state', r.state,
    'createdAt', public.store_review_staff_time(r.created_at),
    'updatedAt', public.store_review_staff_time(r.updated_at),
    'item', jsonb_build_object('productId', r.product_id, 'productTitle', r.product_title, 'variantTitle', r.variant_title),
    'verifiedPurchase', r.order_id is not null,
    'pending', pending.content, 'published', approved.content, 'latest', latest.content,
    'reply', case when reply.review_id is null then null else jsonb_build_object(
      'body', reply.body, 'publishedAt', public.store_review_staff_time(reply.published_at),
      'updatedAt', public.store_review_staff_time(reply.updated_at)) end,
    'recentEvents', coalesce(events.content, '[]'::jsonb)
  )
  from public.store_reviews r
  left join public.store_review_replies reply on reply.review_id = r.id
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at)) content
    from public.store_review_revisions v where v.review_id = r.id and v.status = 'pending'
  ) pending on true
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at)) content
    from public.store_review_revisions v where v.id = r.approved_revision_id and v.review_id = r.id
  ) approved on true
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at)) content
    from public.store_review_revisions v where v.review_id = r.id
    order by v.submitted_at desc, v.id desc limit 1
  ) latest on true
  left join lateral (
    select jsonb_agg(e.content order by e.id desc) content from (
      select ev.id, jsonb_build_object('action', ev.action, 'actorKind', ev.actor_kind,
        'actor', case when ev.actor_kind = 'staff' then ev.actor else null end,
        'note', ev.note, 'createdAt', public.store_review_staff_time(ev.created_at)) content
      from public.store_review_events ev where ev.review_id = r.id order by ev.id desc limit 10
    ) e
  ) events on true
  where r.shop_id = p_shop_id
    and (p_after_created_at is null or (r.created_at, r.id) > (p_after_created_at, p_after_id))
    and case p_filter
      when 'pending' then pending.content is not null and r.state <> 'withdrawn'
      when 'published' then r.state = 'active' and r.approved_revision_id is not null
      when 'hidden' then r.state = 'hidden'
      else true end
  order by r.created_at, r.id
  limit least(greatest(coalesce(p_limit, 21), 1), 51);
end;
$$;

revoke all on function
  public.store_buyer_reviewed_products(text,text,text[]),
  public.store_review_moderation_page_v3(uuid,text,text,integer,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function
  public.store_buyer_reviewed_products(text,text,text[]),
  public.store_review_moderation_page_v3(uuid,text,text,integer,timestamptz,uuid)
  to service_role;
notify pgrst, 'reload schema';
