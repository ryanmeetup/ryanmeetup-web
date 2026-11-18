-- RMT-only staff boundary. Shopify buyers never become Tasks members.
-- These invoker functions are callable only by the privileged Tasks server;
-- they also recheck its authenticated actor inside the database transaction.
create index if not exists store_reviews_staff_queue
  on public.store_reviews (shop_id, created_at, id);

create or replace function public.store_require_review_owner(p_actor uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.profiles p
  where p.id = p_actor and p.app_role = 'owner' and p.onboarding_completed
  for share;
  if not found then
    raise exception 'Review moderation requires an app owner' using errcode = '42501';
  end if;
end;
$$;

-- Exact microseconds are retained for optimistic concurrency and pagination.
create or replace function public.store_review_staff_time(p_at timestamptz)
returns text language sql immutable set search_path = '' as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
$$;

-- Oldest first, with no rating filter or sorting preference. Only explicit
-- staff fields are returned: no tokens, customer subjects, or order IDs.
create or replace function public.store_review_moderation_page(
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
    'pending', pending.content, 'published', approved.content, 'latest', latest.content,
    'recentEvents', coalesce(events.content, '[]'::jsonb)
  )
  from public.store_reviews r
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

-- One lock order for buyer edits, withdrawals, and staff decisions: review,
-- then revision. A changed review/replaced pending edit returns false rather
-- than applying a decision to content the moderator has not seen.
create or replace function public.store_moderate_review(
  p_actor uuid, p_shop_id text, p_review_id uuid, p_expected_updated_at timestamptz,
  p_action text, p_revision_id uuid, p_note text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_review public.store_reviews;
begin
  perform public.store_require_review_owner(p_actor);
  if p_action is null or p_action not in ('approve', 'reject', 'hide', 'restore')
    or (p_action in ('approve', 'reject')) <> (p_revision_id is not null)
    or (p_note is not null and (p_note <> btrim(p_note) or char_length(p_note) not between 1 and 1000))
    or (p_action in ('reject', 'hide') and p_note is null) then
    raise exception 'Invalid moderation decision' using errcode = '22023';
  end if;
  select r.* into v_review from public.store_reviews r
  where r.id = p_review_id and r.shop_id = p_shop_id for update;
  if not found or v_review.state = 'withdrawn'
    or p_expected_updated_at is null or v_review.updated_at <> p_expected_updated_at then
    return false;
  end if;
  if p_action in ('approve', 'reject') then
    perform 1 from public.store_review_revisions v
    where v.id = p_revision_id and v.review_id = v_review.id and v.status = 'pending';
    if not found then return false; end if;
    -- Approval of a hidden edit does not restore it to the storefront.
    if not public.store_decide_review_revision(p_revision_id, p_shop_id, p_action = 'approve', p_actor::text, p_note) then
      return false;
    end if;
    -- Rejection also advances the review's concurrency token.
    update public.store_reviews set updated_at = clock_timestamp() where id = v_review.id;
    return true;
  end if;
  return public.store_set_review_hidden(p_review_id, p_shop_id, p_action = 'hide', p_actor::text, p_note);
end;
$$;

revoke all on function
  public.store_require_review_owner(uuid), public.store_review_staff_time(timestamptz),
  public.store_review_moderation_page(uuid,text,text,integer,timestamptz,uuid),
  public.store_moderate_review(uuid,text,uuid,timestamptz,text,uuid,text)
  from public, anon, authenticated;
grant execute on function
  public.store_require_review_owner(uuid), public.store_review_staff_time(timestamptz),
  public.store_review_moderation_page(uuid,text,text,integer,timestamptz,uuid),
  public.store_moderate_review(uuid,text,uuid,timestamptz,text,uuid,text)
  to service_role;
notify pgrst, 'reload schema';
