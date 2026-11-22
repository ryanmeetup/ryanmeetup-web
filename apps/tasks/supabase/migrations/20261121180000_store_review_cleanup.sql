-- RMT only. Daily housekeeping for store reviews and buyer sign-in.
--
-- Deletes rows that can no longer affect anyone, and lists review-photo
-- objects the Store server should remove from the private bucket (storage
-- objects cannot be removed from SQL):
--   * sign-in flows and sessions a day past their absolute expiry
--     (revoked sessions included: their expiry never moves);
--   * upload and write budgets whose windows closed long ago;
--   * photo drafts that expired a day ago without ever being attached;
--   * attached photos no revision references any more (a buyer removed them
--     from a pending edit), once their review has been quiet for a day;
--   * objects in the shop's folder with no draft row at all, a day old. This
--     also retries a review deletion whose object removal failed, and any
--     object removal from an earlier run that did not complete.
-- Rows are deleted before their objects, so an interrupted run only leaves
-- orphans the next run finds. Each category is bounded per call and skips
-- rows another transaction holds, so it never waits on a buyer or moderator.

create or replace function public.store_review_cleanup(p_shop_id text, p_limit integer default 500)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_grace interval := interval '1 day';
  v_prefix text := p_shop_id || '/';
  v_authorizations integer;
  v_sessions integer;
  v_photo_budgets integer;
  v_write_budgets integer;
  v_expired text[];
  v_unreferenced text[];
  v_orphans text[];
begin
  if p_shop_id is null or p_shop_id !~ '^[1-9][0-9]{0,19}$' or p_limit is null or p_limit not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'Invalid review cleanup request';
  end if;

  with doomed as (
    select state_hash from public.store_customer_authorizations
    where shop_id = p_shop_id and expires_at < v_now - v_grace
    order by expires_at limit p_limit for update skip locked
  )
  delete from public.store_customer_authorizations a using doomed where a.state_hash = doomed.state_hash;
  get diagnostics v_authorizations = row_count;

  with doomed as (
    select session_hash from public.store_customer_sessions
    where shop_id = p_shop_id and expires_at < v_now - v_grace
    order by expires_at limit p_limit for update skip locked
  )
  delete from public.store_customer_sessions s using doomed where s.session_hash = doomed.session_hash;
  get diagnostics v_sessions = row_count;

  -- Upload windows last ten minutes and write windows at most a day.
  with doomed as (
    select customer_subject from public.store_review_photo_budgets
    where shop_id = p_shop_id and window_started_at < v_now - v_grace
    order by window_started_at limit p_limit for update skip locked
  )
  delete from public.store_review_photo_budgets b using doomed
  where b.shop_id = p_shop_id and b.customer_subject = doomed.customer_subject;
  get diagnostics v_photo_budgets = row_count;

  with doomed as (
    select bucket, actor from public.store_review_write_budgets
    where shop_id = p_shop_id and window_started_at < v_now - interval '2 days'
    order by window_started_at limit p_limit for update skip locked
  )
  delete from public.store_review_write_budgets b using doomed
  where b.shop_id = p_shop_id and b.bucket = doomed.bucket and b.actor = doomed.actor;
  get diagnostics v_write_budgets = row_count;

  -- An expired draft can never be attached: attachment requires an unexpired one.
  with doomed as (
    select d.id from public.store_review_photo_drafts d
    where d.shop_id = p_shop_id and d.state in ('uploading', 'ready', 'discarded') and d.expires_at < v_now - v_grace
      and not exists (select 1 from public.store_review_revision_photos rp where rp.photo_id = d.id)
    order by d.expires_at limit p_limit for update of d skip locked
  ), removed as (
    delete from public.store_review_photo_drafts d using doomed where d.id = doomed.id returning d.id
  )
  select coalesce(array_agg(v_prefix || removed.id::text || '.webp'), '{}') into v_expired from removed;

  -- Locking the review too skips any review a buyer is editing right now; a
  -- day of quiet means no open editor can still be offering the photo.
  with doomed as (
    select d.id from public.store_review_photo_drafts d
    join public.store_reviews r on r.id = d.attached_review_id
    where d.shop_id = p_shop_id and d.state = 'attached' and r.updated_at < v_now - v_grace
      and not exists (select 1 from public.store_review_revision_photos rp where rp.photo_id = d.id)
    order by d.created_at limit p_limit for update of d, r skip locked
  ), removed as (
    delete from public.store_review_photo_drafts d using doomed where d.id = doomed.id returning d.id
  )
  select coalesce(array_agg(v_prefix || removed.id::text || '.webp'), '{}') into v_unreferenced from removed;

  -- Uploads create their draft row before the object, so an object without a
  -- row is never an upload in progress. The day of grace is extra margin.
  select coalesce(array_agg(o.name), '{}') into v_orphans from (
    select o.name from storage.objects o
    where o.bucket_id = 'store-review-photos' and starts_with(o.name, v_prefix) and o.created_at < v_now - v_grace
      and not exists (select 1 from public.store_review_photo_drafts d
        where d.shop_id = p_shop_id and v_prefix || d.id::text || '.webp' = o.name)
      and not (o.name = any (v_expired) or o.name = any (v_unreferenced))
    order by o.created_at limit p_limit
  ) o;

  return jsonb_build_object(
    'authorizations', v_authorizations,
    'sessions', v_sessions,
    'photoBudgets', v_photo_budgets,
    'writeBudgets', v_write_budgets,
    'expiredDrafts', cardinality(v_expired),
    'unreferencedPhotos', cardinality(v_unreferenced),
    'orphanObjects', cardinality(v_orphans),
    'objectPaths', to_jsonb(v_expired || v_unreferenced || v_orphans)
  );
end;
$$;

revoke all on function public.store_review_cleanup(text, integer) from public, anon, authenticated;
grant execute on function public.store_review_cleanup(text, integer) to service_role;
