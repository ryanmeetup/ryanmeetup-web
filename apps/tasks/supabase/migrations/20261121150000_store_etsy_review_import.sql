-- RMT only. Reviews imported from the Ryan Meetup Etsy shop.
--
-- An imported review keeps where it came from: `source` is 'etsy' and
-- `source_review_id` is the Etsy review id, which also makes the import safe to
-- re-run. Its owner is the namespaced subject 'etsy:<review id>', which no
-- Shopify buyer session can hold (those are gid://shopify/Customer/... ids), so
-- buyer reads, edits and withdrawals never reach it, while photo ownership
-- checks keep working unchanged.
--
-- `product_id` is the Shopify product when the Etsy listing has one. For a
-- listing that never came to the store it is the Etsy listing id: no Shopify
-- product resolves from it, so the review appears only in the shop-wide feed
-- and home showcase under its stored title, the same path a delisted product's
-- reviews take, and never on a product page or in catalog ratings.
--
-- Etsy reviews have no titles, so a revision may omit one only when its review
-- is imported. Store reviews still require a title.
--
-- The public and staff projections add `source`, so the storefront can label an
-- imported review "Verified Etsy purchase". Parsers accept rows with or without
-- it, so the code and this migration can land in either order.

alter table public.store_reviews add column if not exists source text not null default 'store';
alter table public.store_reviews add column if not exists source_review_id text;
alter table public.store_reviews drop constraint if exists store_reviews_source_check;
alter table public.store_reviews add constraint store_reviews_source_check check (
  source in ('store', 'etsy')
  and (source = 'store') = (source_review_id is null)
  and (source_review_id is null or source_review_id ~ '^[1-9][0-9]{0,19}$')
  and (source = 'store' or (customer_subject = source || ':' || source_review_id and order_id is null)));
create unique index if not exists store_reviews_one_per_source_review
  on public.store_reviews (shop_id, source, source_review_id) where source_review_id is not null;

alter table public.store_review_revisions alter column title drop not null;

create or replace function public.store_review_revision_title_required()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.title is null and not exists (
    select 1 from public.store_reviews r where r.id = new.review_id and r.source <> 'store'
  ) then
    raise exception 'Review title is required' using errcode = '23502';
  end if;
  return new;
end;
$$;
drop trigger if exists store_review_revisions_title_required on public.store_review_revisions;
create trigger store_review_revisions_title_required
  before insert or update of title, review_id on public.store_review_revisions
  for each row execute function public.store_review_revision_title_required();

alter table public.store_review_events drop constraint if exists store_review_events_action_check;
alter table public.store_review_events add constraint store_review_events_action_check check (
  action in ('submitted','resubmitted','edited','withdrawn','approved','rejected','hidden','restored','reply_set','reply_removed','photo_approved','photo_rejected','imported'));

-- Writes one Etsy review as published, dated when it was left on Etsy, with an
-- optional reply and already staged photos (staged under the review's own
-- subject and product). Re-running with the same Etsy review id changes nothing.
create or replace function public.store_import_etsy_review(
  p_shop_id text, p_etsy_review_id text, p_product_id text, p_product_title text,
  p_rating numeric, p_body text, p_display_name text, p_reviewed_at timestamptz,
  p_reply_body text, p_reply_at timestamptz, p_photo_ids uuid[], p_actor text
) returns table (review_id uuid, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_subject text := 'etsy:' || p_etsy_review_id;
  v_review uuid;
  v_revision uuid;
  v_photos uuid[] := coalesce(p_photo_ids, '{}');
  v_attached integer;
begin
  if p_etsy_review_id is null or p_etsy_review_id !~ '^[1-9][0-9]{0,19}$' or p_reviewed_at is null
    or (p_reply_body is null) <> (p_reply_at is null) or cardinality(v_photos) > 5
    or p_actor is null or length(p_actor) not between 1 and 200 then
    raise exception 'Invalid Etsy review import' using errcode = '22023';
  end if;

  insert into public.store_reviews as r (shop_id, customer_subject, product_id, product_title, source, source_review_id,
    first_published_at, created_at, updated_at)
  values (p_shop_id, v_subject, p_product_id, p_product_title, 'etsy', p_etsy_review_id,
    p_reviewed_at, p_reviewed_at, clock_timestamp())
  on conflict (shop_id, source, source_review_id) where source_review_id is not null do nothing
  returning r.id into v_review;
  if v_review is null then
    return query select r.id, 'exists'::text from public.store_reviews r
      where r.shop_id = p_shop_id and r.source = 'etsy' and r.source_review_id = p_etsy_review_id;
    return;
  end if;

  insert into public.store_review_revisions (review_id, rating, title, body, name_style, display_name,
    status, submitted_at, decided_at, decided_by)
  values (v_review, p_rating, null, p_body, 'full', p_display_name, 'approved', p_reviewed_at, p_reviewed_at, p_actor)
  returning id into v_revision;
  update public.store_reviews r set approved_revision_id = v_revision where r.id = v_review;

  update public.store_review_photo_drafts d set state = 'attached', attached_review_id = v_review
  where d.id = any (v_photos) and d.shop_id = p_shop_id and d.customer_subject = v_subject
    and d.product_id = p_product_id and d.state = 'ready';
  get diagnostics v_attached = row_count;
  if v_attached <> cardinality(v_photos) then
    raise exception 'Imported photos must be staged for this review' using errcode = '22023';
  end if;
  insert into public.store_review_revision_photos (revision_id, photo_id, position, moderation_state)
  select v_revision, photo.id, photo.position, 'approved'
  from unnest(v_photos) with ordinality as photo(id, position);

  if p_reply_body is not null then
    insert into public.store_review_replies (review_id, body, author, published_at, updated_at)
    values (v_review, p_reply_body, p_actor, p_reply_at, p_reply_at);
  end if;
  insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor, note)
  values (v_review, v_revision, 'imported', 'staff', p_actor, 'Etsy review ' || p_etsy_review_id);
  return query select v_review, 'created'::text;
end;
$$;

-- Unchanged from 20261121030000 apart from `source`.
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
  where r.shop_id = p_shop_id and r.product_id = any (p_product_ids)
    and r.state = 'active' and r.approved_revision_id is not null
    and (p_after_published_at is null or (r.first_published_at, r.id) < (p_after_published_at, p_after_id))
  order by r.first_published_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- Unchanged from 20261121030000 apart from `source`.
create or replace function public.store_review_moderation_page_v5(
  p_actor uuid, p_shop_id text, p_filter text, p_product_id text, p_limit integer,
  p_after_created_at timestamptz default null, p_after_id uuid default null
) returns setof jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform public.store_require_review_owner(p_actor);
  if p_filter is null or p_filter not in ('pending', 'published', 'hidden', 'rejected', 'all')
    or (p_product_id is not null and p_product_id !~ '^[1-9][0-9]{0,19}$')
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
    'source', r.source,
    'pending', pending.content, 'published', approved.content, 'latest', latest.content,
    'rejected', case when latest.status = 'rejected' and r.state <> 'withdrawn' then latest.content else null end,
    'reply', case when reply.review_id is null then null else jsonb_build_object(
      'body', reply.body, 'publishedAt', public.store_review_staff_time(reply.published_at),
      'updatedAt', public.store_review_staff_time(reply.updated_at)) end,
    'recentEvents', coalesce(events.content, '[]'::jsonb)
  )
  from public.store_reviews r
  left join public.store_review_replies reply on reply.review_id = r.id
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at), 'photos', public.store_staff_revision_photos(v.id)) content
    from public.store_review_revisions v where v.review_id = r.id and v.status = 'pending'
  ) pending on true
  left join lateral (
    select jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at), 'photos', public.store_staff_revision_photos(v.id)) content
    from public.store_review_revisions v where v.id = r.approved_revision_id and v.review_id = r.id
  ) approved on true
  left join lateral (
    select v.status, jsonb_build_object('id', v.id, 'rating', v.rating, 'title', v.title, 'body', v.body,
      'displayName', v.display_name, 'submittedAt', public.store_review_staff_time(v.submitted_at), 'photos', public.store_staff_revision_photos(v.id)) content
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
    and (p_product_id is null or r.product_id = p_product_id)
    and (p_after_created_at is null or (r.created_at, r.id) > (p_after_created_at, p_after_id))
    and case p_filter
      when 'pending' then r.state <> 'withdrawn' and (pending.content is not null or public.store_review_has_pending_photos(r.id))
      when 'published' then r.state = 'active' and r.approved_revision_id is not null
      when 'hidden' then r.state = 'hidden'
      when 'rejected' then latest.status = 'rejected' and r.state <> 'withdrawn'
      else true end
  order by r.created_at, r.id
  limit least(greatest(coalesce(p_limit, 21), 1), 51);
end;
$$;

revoke all on function public.store_review_revision_title_required() from public, anon, authenticated;
revoke all on function public.store_import_etsy_review(text,text,text,text,numeric,text,text,timestamptz,text,timestamptz,uuid[],text)
  from public, anon, authenticated;
grant execute on function public.store_import_etsy_review(text,text,text,text,numeric,text,text,timestamptz,text,timestamptz,uuid[],text)
  to service_role;
notify pgrst, 'reload schema';
