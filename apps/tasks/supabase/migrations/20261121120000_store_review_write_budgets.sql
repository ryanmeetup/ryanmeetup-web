-- Store review write budgets (RMT only).
--
-- Throttles review submissions and edits so one buyer, or one network signing
-- in with throwaway Shopify accounts, cannot flood the moderation queue. The
-- Store server names each rule (bucket, actor, limit, window) and checks them
-- in one call: either every rule has room and all are consumed, or none are and
-- the caller gets the longest wait. Actors are opaque server-made keys; raw IP
-- addresses are never stored.

create table if not exists public.store_review_write_budgets (
  shop_id text not null check (shop_id ~ '^[1-9][0-9]{0,19}$'),
  bucket text not null check (bucket ~ '^[a-z][a-z0-9_:-]{0,63}$'),
  actor text not null check (length(actor) between 1 and 512 and actor !~ '[[:cntrl:]]'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (shop_id, bucket, actor)
);
create index if not exists store_review_write_budgets_window_idx
  on public.store_review_write_budgets (shop_id, window_started_at);

alter table public.store_review_write_budgets enable row level security;
revoke all on public.store_review_write_budgets from public, anon, authenticated;
grant select, insert, update, delete on public.store_review_write_budgets to service_role;

create or replace function public.store_consume_review_write_budget(p_shop_id text, p_rules jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_rule record;
  v_row public.store_review_write_budgets;
  v_retry integer := 0;
begin
  if p_shop_id is null or p_shop_id !~ '^[1-9][0-9]{0,19}$' or jsonb_typeof(p_rules) is distinct from 'array'
    or jsonb_array_length(p_rules) not between 1 and 8 then
    raise exception using errcode = '22023', message = 'Invalid review write budget request';
  end if;

  -- Lock every rule's key in a stable order before reading, so concurrent
  -- writers serialize per key and cannot deadlock or both take the last slot.
  for v_rule in
    select r.value->>'bucket' as bucket, r.value->>'actor' as actor,
      (r.value->>'limit')::integer as max_attempts, (r.value->>'windowSeconds')::integer as window_seconds
    from jsonb_array_elements(p_rules) r order by 1, 2
  loop
    if v_rule.bucket is null or v_rule.bucket !~ '^[a-z][a-z0-9_:-]{0,63}$'
      or v_rule.actor is null or length(v_rule.actor) not between 1 and 512 or v_rule.actor ~ '[[:cntrl:]]'
      or v_rule.max_attempts is null or v_rule.max_attempts not between 1 and 1000
      or v_rule.window_seconds is null or v_rule.window_seconds not between 60 and 86400 then
      raise exception using errcode = '22023', message = 'Invalid review write budget rule';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(p_shop_id, v_rule.bucket, v_rule.actor)::text, 0));
    select * into v_row from public.store_review_write_budgets
      where shop_id = p_shop_id and bucket = v_rule.bucket and actor = v_rule.actor;
    if found and v_row.window_started_at > v_now - make_interval(secs => v_rule.window_seconds)
      and v_row.attempts >= v_rule.max_attempts then
      v_retry := greatest(v_retry, 1, ceil(extract(epoch from
        v_row.window_started_at + make_interval(secs => v_rule.window_seconds) - v_now))::integer);
    end if;
  end loop;

  if v_retry > 0 then
    return jsonb_build_object('allowed', false, 'retryAfter', least(v_retry, 86400));
  end if;

  for v_rule in
    select r.value->>'bucket' as bucket, r.value->>'actor' as actor,
      (r.value->>'windowSeconds')::integer as window_seconds
    from jsonb_array_elements(p_rules) r
  loop
    insert into public.store_review_write_budgets (shop_id, bucket, actor, window_started_at, attempts)
      values (p_shop_id, v_rule.bucket, v_rule.actor, v_now, 1)
    on conflict (shop_id, bucket, actor) do update set
      attempts = case when store_review_write_budgets.window_started_at <= v_now - make_interval(secs => v_rule.window_seconds)
        then 1 else store_review_write_budgets.attempts + 1 end,
      window_started_at = case when store_review_write_budgets.window_started_at <= v_now - make_interval(secs => v_rule.window_seconds)
        then v_now else store_review_write_budgets.window_started_at end;
  end loop;

  -- No window exceeds a day, so older rows can never block anyone again.
  delete from public.store_review_write_budgets
    where shop_id = p_shop_id and window_started_at < v_now - interval '2 days';

  return jsonb_build_object('allowed', true, 'retryAfter', 0);
end;
$$;

revoke all on function public.store_consume_review_write_budget(text,jsonb) from public, anon, authenticated;
grant execute on function public.store_consume_review_write_budget(text,jsonb) to service_role;
