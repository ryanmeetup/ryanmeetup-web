-- A buyer's own reviews for "My reviews", RMT only. Unlike the public read,
-- this includes pending, rejected, hidden, and withdrawn reviews, but only
-- ever for the verified buyer the storefront names, and never staff notes.

create or replace function public.store_buyer_reviews(p_shop_id text, p_subject text, p_limit integer default 21,
  p_after_created_at timestamptz default null, p_after_id uuid default null, p_review_id uuid default null)
returns setof jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id,
    'lineId', r.line_id,
    'createdAt', public.store_review_staff_time(r.created_at),
    'item', jsonb_build_object('productId', r.product_id, 'productTitle', r.product_title, 'variantTitle', r.variant_title),
    'status', case
      when r.state = 'withdrawn' then 'withdrawn'
      when r.state = 'hidden' then 'hidden'
      when r.approved_revision_id is not null then 'published'
      when pending.id is not null then 'pending'
      else 'rejected' end,
    'hasPendingEdit', r.state = 'active' and r.approved_revision_id is not null and pending.id is not null,
    'publishedAt', case when r.first_published_at is null then null else public.store_review_iso(r.first_published_at) end,
    'updatedAt', public.store_review_staff_time(r.updated_at),
    -- What the buyer last wrote: a waiting edit, else the live version, else their latest attempt.
    'current', jsonb_build_object('rating', shown.rating, 'title', shown.title, 'body', shown.body,
      'nameStyle', shown.name_style, 'displayName', shown.display_name)
  )
  from public.store_reviews r
  left join public.store_review_revisions pending on pending.review_id = r.id and pending.status = 'pending'
  left join public.store_review_revisions approved on approved.id = r.approved_revision_id
  left join lateral (
    select v.* from public.store_review_events e
    join public.store_review_revisions v on v.id = e.revision_id and v.review_id = r.id
    where e.review_id = r.id and e.action in ('submitted','resubmitted','edited')
    order by e.id desc limit 1
  ) latest on true
  cross join lateral (select coalesce(pending.rating, approved.rating, latest.rating) as rating,
    case when pending.id is not null then pending.title when approved.id is not null then approved.title else latest.title end as title,
    coalesce(pending.body, approved.body, latest.body) as body,
    coalesce(pending.name_style, approved.name_style, latest.name_style) as name_style,
    coalesce(pending.display_name, approved.display_name, latest.display_name) as display_name) shown
  where r.shop_id = p_shop_id and r.customer_subject = p_subject
    and (p_review_id is null or r.id = p_review_id)
    and (p_after_created_at is null or (r.created_at,r.id) < (p_after_created_at,p_after_id))
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit,21),1),21);
$$;


-- Product composers query only the verified purchased lines they can offer,
-- independent of how many reviews the buyer has written elsewhere.
create or replace function public.store_buyer_reviewed_lines(p_shop_id text, p_subject text, p_line_ids text[])
returns setof text language sql stable security invoker set search_path = '' as $$
  select distinct r.line_id from public.store_reviews r
  where r.shop_id=p_shop_id and r.customer_subject=p_subject and r.state<>'withdrawn'
    and r.line_id=any(p_line_ids) order by r.line_id;
$$;

-- A resubmitted withdrawal is a new public review, so it loses the original
-- publish date and takes a fresh one when staff approve it. Otherwise it would
-- reappear deep in the newest-first list with a date from before withdrawal.
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

  update public.store_reviews r set state = 'active', first_published_at = null, updated_at = clock_timestamp()
  where r.id = v_review.id;
  insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name)
  values (v_review.id, p_rating, p_title, p_body, p_name_style, p_display_name) returning id into v_revision;
  insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor)
  values (v_review.id, v_revision, 'resubmitted', 'buyer', p_subject);
  return query select v_review.id, 'resubmitted'::text;
end;
$$;

-- The immutable original write functions remain private. Buyer-facing writes
-- must compare the exact version seen by that buyer under the review row lock.
create or replace function public.store_edit_buyer_review(
  p_review_id uuid, p_shop_id text, p_subject text, p_expected_updated_at timestamptz,
  p_rating smallint, p_title text, p_body text, p_name_style text, p_display_name text
) returns text language plpgsql security invoker set search_path = '' as $$
declare v_review public.store_reviews;
begin
  select r.* into v_review from public.store_reviews r
  where r.id=p_review_id and r.shop_id=p_shop_id and r.customer_subject=p_subject for update;
  if not found then return 'not_found'; end if;
  if v_review.state<>'active' then return 'closed'; end if;
  if p_expected_updated_at is null or v_review.updated_at<>p_expected_updated_at then return 'conflict'; end if;
  return public.store_edit_review(p_review_id,p_shop_id,p_subject,p_rating,p_title,p_body,p_name_style,p_display_name);
end;
$$;

create or replace function public.store_withdraw_buyer_review(
  p_review_id uuid, p_shop_id text, p_subject text, p_expected_updated_at timestamptz
) returns text language plpgsql security invoker set search_path = '' as $$
declare v_review public.store_reviews;
begin
  select r.* into v_review from public.store_reviews r
  where r.id=p_review_id and r.shop_id=p_shop_id and r.customer_subject=p_subject for update;
  if not found then return 'not_found'; end if;
  if v_review.state='withdrawn' then return 'withdrawn'; end if;
  if p_expected_updated_at is null or v_review.updated_at<>p_expected_updated_at then return 'conflict'; end if;
  if public.store_withdraw_review(p_review_id,p_shop_id,p_subject) then return 'withdrawn'; end if;
  return 'not_found';
end;
$$;

revoke all on function
  public.store_buyer_reviews(text,text,integer,timestamptz,uuid,uuid),
  public.store_buyer_reviewed_lines(text,text,text[]),
  public.store_edit_buyer_review(uuid,text,text,timestamptz,smallint,text,text,text,text),
  public.store_withdraw_buyer_review(uuid,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function
  public.store_buyer_reviews(text,text,integer,timestamptz,uuid,uuid),
  public.store_buyer_reviewed_lines(text,text,text[]),
  public.store_edit_buyer_review(uuid,text,text,timestamptz,smallint,text,text,text,text),
  public.store_withdraw_buyer_review(uuid,text,text,timestamptz)
  to service_role;
notify pgrst, 'reload schema';
