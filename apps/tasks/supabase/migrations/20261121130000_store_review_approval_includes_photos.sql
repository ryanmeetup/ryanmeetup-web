-- RMT-only. Publishing a review publishes its photos. Approving or
-- republishing a revision also approves every photo on that revision that staff
-- have not decided yet, in the same transaction. A photo staff rejected stays
-- rejected, so staff reject a bad photo first and then publish the rest.
-- The revision's `approved` event records who approved the photos with it; no
-- per-photo event is written, so a five-photo review does not crowd the
-- ten-event history. Individual photo decisions stay available for undoing a
-- rejection or pulling a photo from a live review.

create or replace function public.store_moderate_review(
  p_actor uuid, p_shop_id text, p_review_id uuid, p_expected_updated_at timestamptz,
  p_action text, p_revision_id uuid, p_note text
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_review public.store_reviews;
  v_revision public.store_review_revisions;
  v_now timestamptz;
begin
  perform public.store_require_review_owner(p_actor);
  if p_action is null or p_action not in ('approve', 'reject', 'hide', 'restore', 'republish')
    or (p_action in ('approve', 'reject', 'republish')) <> (p_revision_id is not null)
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
  if p_action = 'republish' then
    select v.* into v_revision from public.store_review_revisions v
    where v.id = p_revision_id and v.review_id = v_review.id and v.status = 'rejected'
    for update;
    if not found then return false; end if;
    perform 1 from public.store_review_revisions w
    where w.review_id = v_review.id and w.id <> v_revision.id
      and (w.status = 'pending' or (w.submitted_at, w.id) > (v_revision.submitted_at, v_revision.id));
    if found then return false; end if;
    -- Millisecond precision, matching approval, so public dates stay exact page cursors.
    v_now := date_trunc('milliseconds', clock_timestamp());
    update public.store_review_revisions v set status = 'superseded'
    where v.review_id = v_review.id and v.status = 'approved';
    update public.store_review_revisions v set status = 'approved', decided_at = v_now, decided_by = p_actor::text
    where v.id = v_revision.id;
    update public.store_review_revision_photos set moderation_state = 'approved'
    where revision_id = v_revision.id and moderation_state = 'pending';
    update public.store_reviews r set approved_revision_id = v_revision.id,
      first_published_at = coalesce(r.first_published_at, v_now), updated_at = v_now
    where r.id = v_review.id;
    insert into public.store_review_events (review_id, revision_id, action, actor_kind, actor, note)
    values (v_review.id, v_revision.id, 'approved', 'staff', p_actor::text, p_note);
    return true;
  end if;
  if p_action in ('approve', 'reject') then
    perform 1 from public.store_review_revisions v
    where v.id = p_revision_id and v.review_id = v_review.id and v.status = 'pending';
    if not found then return false; end if;
    -- Approval of a hidden edit does not restore it to the storefront.
    if not public.store_decide_review_revision(p_revision_id, p_shop_id, p_action = 'approve', p_actor::text, p_note) then
      return false;
    end if;
    -- A rejected revision keeps its undecided photos undecided, so publishing
    -- it anyway later approves them then.
    if p_action = 'approve' then
      update public.store_review_revision_photos set moderation_state = 'approved'
      where revision_id = p_revision_id and moderation_state = 'pending';
    end if;
    -- Rejection also advances the review's concurrency token.
    update public.store_reviews set updated_at = clock_timestamp() where id = v_review.id;
    return true;
  end if;
  return public.store_set_review_hidden(p_review_id, p_shop_id, p_action = 'hide', p_actor::text, p_note);
end;
$$;

revoke all on function public.store_moderate_review(uuid,text,uuid,timestamptz,text,uuid,text) from public, anon, authenticated;
grant execute on function public.store_moderate_review(uuid,text,uuid,timestamptz,text,uuid,text) to service_role;
notify pgrst, 'reload schema';
