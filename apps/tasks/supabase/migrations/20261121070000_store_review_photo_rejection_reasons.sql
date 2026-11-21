-- RMT-only. A photo rejection reason now reaches the people who can act on it:
-- staff see it beside the rejected photo, and the buyer sees it on their own
-- review so they can swap the photo and resubmit. The reason belongs to one
-- photo on one revision, and only while that photo is still rejected there; a
-- resubmission starts the photo over as pending, which clears it. Approval
-- notes, hidden and withdrawn reviews, and staff names stay private.

create or replace function public.store_review_photo_rejection_reason(p_review_id uuid, p_revision_id uuid, p_photo_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select nullif(btrim(e.note), '') from public.store_review_events e
  where e.review_id = p_review_id and e.revision_id = p_revision_id and e.photo_id = p_photo_id
    and e.action = 'photo_rejected' and e.actor_kind = 'staff'
  order by e.id desc limit 1;
$$;

create or replace function public.store_staff_revision_photos(p_revision_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'width', p.width, 'height', p.height,
    'state', link.moderation_state,
    'rejectionReason', case when link.moderation_state = 'rejected'
      then public.store_review_photo_rejection_reason(r.id, link.revision_id, link.photo_id) else null end)
    order by link.position), '[]'::jsonb)
  from public.store_review_revision_photos link
  join public.store_review_revisions v on v.id = link.revision_id
  join public.store_reviews r on r.id = v.review_id
  join public.store_review_photo_drafts p on p.id = link.photo_id and p.attached_review_id = r.id
    and p.shop_id = r.shop_id and p.customer_subject = r.customer_subject and p.product_id = r.product_id and p.state = 'attached'
  where link.revision_id = p_revision_id;
$$;

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
    'rejectionReason', case when r.state = 'active' and latest.status = 'rejected' then rejection.note else null end,
    -- Rejected photos on the version the buyer edits from, the same one their photo picker loads.
    'rejectedPhotos', case when r.state = 'active' then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'reason', reason.note) order by link.position)
      from public.store_review_revision_photos link
      join public.store_review_photo_drafts p on p.id = link.photo_id and p.state = 'attached' and p.attached_review_id = r.id
        and p.shop_id = r.shop_id and p.customer_subject = r.customer_subject and p.product_id = r.product_id
      cross join lateral (select public.store_review_photo_rejection_reason(r.id, link.revision_id, link.photo_id) as note) reason
      where link.revision_id = coalesce(pending.id, approved.id, latest.id)
        and link.moderation_state = 'rejected' and reason.note is not null
    ), '[]'::jsonb) else '[]'::jsonb end,
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
  left join lateral (
    select nullif(btrim(e.note), '') as note from public.store_review_events e
    where e.review_id = r.id and e.revision_id = latest.id and e.action = 'rejected' and e.actor_kind = 'staff'
    order by e.id desc limit 1
  ) rejection on true
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

revoke all on function public.store_review_photo_rejection_reason(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.store_review_photo_rejection_reason(uuid,uuid,uuid) to service_role;
