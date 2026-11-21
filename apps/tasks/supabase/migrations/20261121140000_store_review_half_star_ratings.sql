-- Store reviews accept half stars: 0.5 to 5 in steps of 0.5. Existing whole
-- ratings convert losslessly. Plain numeric keeps a whole rating printing as 5,
-- not 5.0; the check holds it to half steps. The write RPCs take numeric
-- instead of smallint, so the smallint overloads are dropped rather than left
-- beside the new ones.
-- The summary keeps five whole-star buckets; a half star counts toward the star
-- it fills (4.5 in 5, 0.5 in 1), and the average stays the exact mean.

alter table public.store_review_revisions drop constraint if exists store_review_revisions_rating_check;
alter table public.store_review_revisions alter column rating type numeric;
alter table public.store_review_revisions add constraint store_review_revisions_rating_check
  check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2));

alter table public.store_review_deletions drop constraint if exists store_review_deletions_rating_check;
alter table public.store_review_deletions alter column rating type numeric;
alter table public.store_review_deletions add constraint store_review_deletions_rating_check
  check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2));

drop function if exists public.store_submit_review_with_photos(text,text,text,text,text,text,text,text,smallint,text,text,text,text,uuid[]);
drop function if exists public.store_edit_buyer_review_with_photos(uuid,text,text,timestamptz,smallint,text,text,text,text,uuid[]);
drop function if exists public.store_edit_buyer_review(uuid,text,text,timestamptz,smallint,text,text,text,text);
drop function if exists public.store_submit_review(text,text,text,text,text,text,text,text,smallint,text,text,text,text);
drop function if exists public.store_edit_review(uuid,text,text,smallint,text,text,text,text);

-- Bodies unchanged from 20261120210000 apart from the rating type.
create or replace function public.store_submit_review(
  p_shop_id text, p_subject text, p_order_id text, p_line_id text,
  p_product_id text, p_variant_id text, p_product_title text, p_variant_title text,
  p_rating numeric, p_title text, p_body text, p_name_style text, p_display_name text
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

-- Body unchanged from 20261120230000 apart from the rating type.
create or replace function public.store_edit_review(
  p_review_id uuid, p_shop_id text, p_subject text,
  p_rating numeric, p_title text, p_body text, p_name_style text, p_display_name text
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  v_state text;
  v_revision uuid;
  v_source uuid;
begin
  select r.state into v_state from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id and r.customer_subject = p_subject
  for update;
  if not found then return 'not_found'; end if;
  if v_state <> 'active' then return 'closed'; end if;

  select coalesce((select id from public.store_review_revisions where review_id = p_review_id and status = 'pending'),
    (select approved_revision_id from public.store_reviews where id = p_review_id),
    (select id from public.store_review_revisions where review_id = p_review_id order by submitted_at desc, id desc limit 1)) into v_source;

  update public.store_review_revisions v set status = 'superseded', decided_at = clock_timestamp()
  where v.review_id = p_review_id and v.status = 'pending';
  insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name)
  values (p_review_id, p_rating, p_title, p_body, p_name_style, p_display_name) returning id into v_revision;
  -- Text-only edits retain the latest photo selection, with a fresh media decision.
  insert into public.store_review_revision_photos (revision_id, photo_id, position)
    select v_revision, photo_id, position from public.store_review_revision_photos where revision_id = v_source;
  update public.store_reviews r set updated_at = clock_timestamp() where r.id = p_review_id;
  insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor)
  values (p_review_id, v_revision, 'edited', 'buyer', p_subject);
  return 'pending';
end;
$$;

-- Body unchanged from 20261120180000 apart from the rating type.
create or replace function public.store_edit_buyer_review(
  p_review_id uuid, p_shop_id text, p_subject text, p_expected_updated_at timestamptz,
  p_rating numeric, p_title text, p_body text, p_name_style text, p_display_name text
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

-- Bodies unchanged from 20261120230000 apart from the rating type.
create or replace function public.store_submit_review_with_photos(
  p_shop_id text, p_subject text, p_order_id text, p_line_id text,
  p_product_id text, p_variant_id text, p_product_title text, p_variant_title text,
  p_rating numeric, p_title text, p_body text, p_name_style text, p_display_name text, p_photo_ids uuid[]
) returns table (review_id uuid, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare v_result record;
begin
  select * into strict v_result from public.store_submit_review(p_shop_id, p_subject, p_order_id, p_line_id,
    p_product_id, p_variant_id, p_product_title, p_variant_title, p_rating, p_title, p_body, p_name_style, p_display_name);
  if v_result.outcome in ('created', 'resubmitted') and not public.store_attach_review_photos(v_result.review_id, p_shop_id, p_subject, p_photo_ids) then
    raise exception using errcode = 'RP001', message = 'Review photos unavailable';
  end if;
  return query select v_result.review_id::uuid, v_result.outcome::text;
exception when sqlstate 'RP001' then
  return query select null::uuid, 'invalid_photos'::text;
end;
$$;

create or replace function public.store_edit_buyer_review_with_photos(
  p_review_id uuid, p_shop_id text, p_subject text, p_expected_updated_at timestamptz,
  p_rating numeric, p_title text, p_body text, p_name_style text, p_display_name text, p_photo_ids uuid[]
) returns text language plpgsql security invoker set search_path = '' as $$
declare v_outcome text;
begin
  v_outcome := public.store_edit_buyer_review(p_review_id, p_shop_id, p_subject, p_expected_updated_at,
    p_rating, p_title, p_body, p_name_style, p_display_name);
  if v_outcome = 'pending' and not public.store_attach_review_photos(p_review_id, p_shop_id, p_subject, p_photo_ids) then
    raise exception using errcode = 'RP001', message = 'Review photos unavailable';
  end if;
  return v_outcome;
exception when sqlstate 'RP001' then return 'invalid_photos';
end;
$$;

-- Body unchanged from 20261121020000 apart from v_rating, which would round a half star.
create or replace function public.store_delete_review(
  p_actor uuid, p_shop_id text, p_review_id uuid, p_expected_updated_at timestamptz,
  p_reason text, p_note text
) returns uuid[]
language plpgsql security invoker set search_path = '' as $$
declare
  v_review public.store_reviews;
  v_rating numeric;
  v_photos uuid[];
begin
  perform public.store_require_review_owner(p_actor);
  if p_reason is null or p_reason not in ('spam', 'false_or_misleading', 'unrelated', 'confidential', 'abusive', 'discriminatory')
    or (p_note is not null and (p_note <> btrim(p_note) or char_length(p_note) not between 1 and 1000)) then
    raise exception 'Invalid review deletion' using errcode = '22023';
  end if;
  select r.* into v_review from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id for update;
  if not found or p_expected_updated_at is null or v_review.updated_at <> p_expected_updated_at then
    return null;
  end if;
  -- The same lock photo attachment takes, so an upload cannot attach mid-delete.
  perform pg_advisory_xact_lock(hashtextextended(
    jsonb_build_array(p_shop_id, v_review.customer_subject, v_review.product_id)::text, 0));

  select v.rating into v_rating from public.store_review_revisions v
  where v.review_id = v_review.id order by v.submitted_at desc, v.id desc limit 1;
  if v_rating is null then
    raise exception 'Review has no revisions' using errcode = 'P0002';
  end if;

  delete from public.store_review_revision_photos rp
  using public.store_review_revisions v
  where rp.revision_id = v.id and v.review_id = v_review.id;
  with removed as (
    delete from public.store_review_photo_drafts d
    where d.shop_id = p_shop_id and d.attached_review_id = v_review.id
    returning d.id
  )
  select coalesce(array_agg(removed.id order by removed.id), '{}') into v_photos from removed;

  insert into public.store_review_deletions (shop_id, review_id, product_id, product_title, rating,
    was_published, verified_purchase, reason, note, photo_count, review_created_at, deleted_by)
  values (p_shop_id, v_review.id, v_review.product_id, v_review.product_title, v_rating,
    v_review.state = 'active' and v_review.approved_revision_id is not null, v_review.order_id is not null,
    p_reason, p_note, cardinality(v_photos), v_review.created_at, p_actor::text);

  -- Revisions, events, and the reply cascade with the review.
  delete from public.store_reviews r where r.id = v_review.id;
  return v_photos;
end;
$$;

-- Totals over every published review in scope, independent of paging. The
-- average is the exact mean; each bucket counts the ratings that fill that star.
create or replace function public.store_review_summary(p_shop_id text, p_product_ids text[])
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with ratings as (
    select v.rating, ceil(v.rating)::int as star from public.store_reviews r
    join public.store_review_revisions v on v.id = r.approved_revision_id
    where r.shop_id = p_shop_id and r.product_id = any (p_product_ids)
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

revoke all on function
  public.store_submit_review(text,text,text,text,text,text,text,text,numeric,text,text,text,text),
  public.store_edit_review(uuid,text,text,numeric,text,text,text,text),
  public.store_edit_buyer_review(uuid,text,text,timestamptz,numeric,text,text,text,text),
  public.store_submit_review_with_photos(text,text,text,text,text,text,text,text,numeric,text,text,text,text,uuid[]),
  public.store_edit_buyer_review_with_photos(uuid,text,text,timestamptz,numeric,text,text,text,text,uuid[])
  from public, anon, authenticated;
grant execute on function
  public.store_submit_review(text,text,text,text,text,text,text,text,numeric,text,text,text,text),
  public.store_edit_review(uuid,text,text,numeric,text,text,text,text),
  public.store_edit_buyer_review(uuid,text,text,timestamptz,numeric,text,text,text,text),
  public.store_submit_review_with_photos(text,text,text,text,text,text,text,text,numeric,text,text,text,text,uuid[]),
  public.store_edit_buyer_review_with_photos(uuid,text,text,timestamptz,numeric,text,text,text,text,uuid[])
  to service_role;

notify pgrst, 'reload schema';
