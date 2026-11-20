-- RMT only. Independent photo decisions, owner previews and revocable Store delivery.
-- Keep the bucket private. Public paths identify a revision; every byte request
-- rechecks its active approved revision/media decision before and after download.
alter table public.store_review_events add column if not exists photo_id uuid;
alter table public.store_review_events drop constraint if exists store_review_events_action_check;
alter table public.store_review_events add constraint store_review_events_action_check check (
  action in ('submitted','resubmitted','edited','withdrawn','approved','rejected','hidden','restored','reply_set','reply_removed','photo_approved','photo_rejected'));

create or replace function public.store_staff_revision_photos(p_revision_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'width', p.width, 'height', p.height,
    'state', link.moderation_state) order by link.position), '[]'::jsonb)
  from public.store_review_revision_photos link
  join public.store_review_revisions v on v.id = link.revision_id
  join public.store_reviews r on r.id = v.review_id
  join public.store_review_photo_drafts p on p.id = link.photo_id and p.attached_review_id = r.id
    and p.shop_id = r.shop_id and p.customer_subject = r.customer_subject and p.product_id = r.product_id and p.state = 'attached'
  where link.revision_id = p_revision_id;
$$;

-- One shared predicate for the queue and sidebar; count reviews, not attachments.
create or replace function public.store_review_has_pending_photos(p_review_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.store_reviews r
    join public.store_review_revisions v on v.review_id = r.id
    join public.store_review_revision_photos link on link.revision_id = v.id
    where r.id = p_review_id and r.state <> 'withdrawn' and link.moderation_state = 'pending'
      and (v.status = 'pending' or v.id = r.approved_revision_id)
  );
$$;

create or replace function public.store_pending_review_count(p_actor uuid, p_shop_id text)
returns bigint language plpgsql security invoker set search_path = '' as $$
begin
  perform public.store_require_review_owner(p_actor);
  return (select count(*) from public.store_reviews r where r.shop_id = p_shop_id and r.state <> 'withdrawn'
    and (exists(select 1 from public.store_review_revisions v where v.review_id = r.id and v.status = 'pending')
      or public.store_review_has_pending_photos(r.id)));
end;
$$;

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


-- Only current pending/published/latest revisions may be previewed or decided.
-- expectedUpdatedAt also revokes old staff preview URLs after any review mutation.
create or replace function public.store_staff_review_photo(
  p_actor uuid, p_shop_id text, p_review_id uuid, p_revision_id uuid, p_photo_id uuid, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform public.store_require_review_owner(p_actor);
  return (
    select jsonb_build_object('id', p.id, 'width', p.width, 'height', p.height, 'byteSize', p.byte_size, 'sha256', p.sha256)
    from public.store_reviews r
    join public.store_review_revisions v on v.review_id = r.id and v.id = p_revision_id
    join public.store_review_revision_photos link on link.revision_id = v.id and link.photo_id = p_photo_id
    join public.store_review_photo_drafts p on p.id = link.photo_id and p.attached_review_id = r.id
      and p.shop_id = r.shop_id and p.customer_subject = r.customer_subject and p.product_id = r.product_id and p.state = 'attached'
    where r.id = p_review_id and r.shop_id = p_shop_id and r.updated_at = p_expected_updated_at
      and (v.status = 'pending' or v.id = r.approved_revision_id or v.id = (
        select recent.id from public.store_review_revisions recent where recent.review_id = r.id
        order by recent.submitted_at desc, recent.id desc limit 1))
  );
end;
$$;

create or replace function public.store_moderate_review_photo(
  p_actor uuid, p_shop_id text, p_review_id uuid, p_revision_id uuid, p_photo_id uuid,
  p_expected_updated_at timestamptz, p_action text, p_note text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_review public.store_reviews;
begin
  perform public.store_require_review_owner(p_actor);
  if p_action is null or p_action not in ('approve','reject') or
    (p_note is not null and (p_note <> btrim(p_note) or char_length(p_note) not between 1 and 1000)) or
    (p_action = 'reject' and p_note is null) then
    raise exception 'Invalid photo decision' using errcode = '22023';
  end if;
  select * into v_review from public.store_reviews where id = p_review_id and shop_id = p_shop_id for update;
  if not found or v_review.state = 'withdrawn' or p_expected_updated_at is null or v_review.updated_at <> p_expected_updated_at then return false; end if;
  if public.store_staff_review_photo(p_actor,p_shop_id,p_review_id,p_revision_id,p_photo_id,p_expected_updated_at) is null then return false; end if;
  update public.store_review_revision_photos set moderation_state = case p_action when 'approve' then 'approved' else 'rejected' end
    where revision_id = p_revision_id and photo_id = p_photo_id
      and moderation_state <> case p_action when 'approve' then 'approved' else 'rejected' end;
  if not found then return false; end if;
  insert into public.store_review_events(review_id,revision_id,photo_id,action,actor_kind,actor,note)
    values(p_review_id,p_revision_id,p_photo_id,case p_action when 'approve' then 'photo_approved' else 'photo_rejected' end,'staff',p_actor::text,p_note);
  update public.store_reviews set updated_at = clock_timestamp() where id = p_review_id;
  return true;
end;
$$;

create or replace function public.store_public_review_photo(p_shop_id text, p_review_id uuid, p_revision_id uuid, p_photo_id uuid)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'width', p.width, 'height', p.height, 'byteSize', p.byte_size, 'sha256', p.sha256)
  from public.store_reviews r
  join public.store_review_revisions v on v.id = r.approved_revision_id and v.review_id = r.id
  join public.store_review_revision_photos link on link.revision_id = v.id and link.moderation_state = 'approved'
  join public.store_review_photo_drafts p on p.id = link.photo_id and p.attached_review_id = r.id
    and p.state = 'attached' and p.shop_id = r.shop_id and p.product_id = r.product_id and p.customer_subject = r.customer_subject
  where r.shop_id = p_shop_id and r.id = p_review_id and r.state = 'active'
    and v.id = p_revision_id and p.id = p_photo_id;
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

revoke all on function public.store_staff_revision_photos(uuid), public.store_review_has_pending_photos(uuid),
  public.store_pending_review_count(uuid,text), public.store_review_moderation_page_v5(uuid,text,text,text,integer,timestamptz,uuid),
  public.store_staff_review_photo(uuid,text,uuid,uuid,uuid,timestamptz),
  public.store_moderate_review_photo(uuid,text,uuid,uuid,uuid,timestamptz,text,text),
  public.store_public_review_photo(text,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.store_staff_revision_photos(uuid), public.store_review_has_pending_photos(uuid),
  public.store_pending_review_count(uuid,text), public.store_review_moderation_page_v5(uuid,text,text,text,integer,timestamptz,uuid),
  public.store_staff_review_photo(uuid,text,uuid,uuid,uuid,timestamptz),
  public.store_moderate_review_photo(uuid,text,uuid,uuid,uuid,timestamptz,text,text),
  public.store_public_review_photo(text,uuid,uuid,uuid) to service_role;
notify pgrst, 'reload schema';
