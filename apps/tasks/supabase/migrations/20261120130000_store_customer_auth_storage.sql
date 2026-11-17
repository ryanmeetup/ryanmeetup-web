-- Shared-backend storage only. The storefront receives no Tasks admin key.
-- A narrowly authenticated backend interface must precede storefront access.
create table if not exists public.store_customer_authorizations (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  browser_binding_hash text not null check (browser_binding_hash ~ '^[a-f0-9]{64}$'),
  shop_id text not null check (shop_id ~ '^[1-9][0-9]*$'),
  client_id text not null check (length(client_id) between 1 and 200),
  issuer text not null check (issuer = 'https://shopify.com/authentication/' || shop_id),
  redirect_uri text not null check (redirect_uri like 'https://%/api/reviews/auth/callback'),
  encrypted_flow text check (left(encrypted_flow, 3) = 'v1.' and octet_length(encrypted_flow) between 32 and 65536),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  check (expires_at = created_at + interval '10 minutes'),
  check ((consumed_at is null and encrypted_flow is not null)
    or (consumed_at is not null and encrypted_flow is null))
);
create index if not exists store_customer_authorizations_expiry
  on public.store_customer_authorizations (expires_at);

create table if not exists public.store_customer_sessions (
  session_hash text primary key check (session_hash ~ '^[a-f0-9]{64}$'),
  shop_id text not null check (shop_id ~ '^[1-9][0-9]*$'),
  client_id text not null check (length(client_id) between 1 and 200),
  issuer text not null check (issuer = 'https://shopify.com/authentication/' || shop_id),
  subject text not null check (length(subject) between 1 and 512),
  encrypted_tokens text check (left(encrypted_tokens, 3) = 'v1.' and octet_length(encrypted_tokens) between 32 and 65536),
  access_expires_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 0 check (revision >= 0),
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (access_expires_at > created_at),
  check ((revoked_at is null and encrypted_tokens is not null)
    or (revoked_at is not null and encrypted_tokens is null))
);
create index if not exists store_customer_sessions_expiry
  on public.store_customer_sessions (expires_at);

alter table public.store_customer_authorizations enable row level security;
alter table public.store_customer_sessions enable row level security;
revoke all on public.store_customer_authorizations, public.store_customer_sessions
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.store_customer_authorizations, public.store_customer_sessions to service_role;

create or replace function public.store_get_customer_authorization(
  p_state_hash text, p_browser_binding_hash text, p_shop_id text,
  p_client_id text, p_issuer text, p_redirect_uri text
) returns setof public.store_customer_authorizations
language sql security invoker set search_path = '' as $$
  select a.* from public.store_customer_authorizations a
  where a.state_hash = p_state_hash and a.browser_binding_hash = p_browser_binding_hash
    and a.shop_id = p_shop_id and a.client_id = p_client_id
    and a.issuer = p_issuer and a.redirect_uri = p_redirect_uri
    and a.consumed_at is null and a.created_at <= clock_timestamp()
    and a.expires_at > clock_timestamp();
$$;

-- Retain the primary-key tombstone until expiry; never upsert/reopen a flow.
create or replace function public.store_consume_customer_authorization(
  p_state_hash text, p_browser_binding_hash text, p_shop_id text,
  p_client_id text, p_issuer text, p_redirect_uri text
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.store_customer_authorizations a
  set consumed_at = clock_timestamp(), encrypted_flow = null
  where a.state_hash = p_state_hash and a.browser_binding_hash = p_browser_binding_hash
    and a.shop_id = p_shop_id and a.client_id = p_client_id
    and a.issuer = p_issuer and a.redirect_uri = p_redirect_uri
    and a.consumed_at is null and a.created_at <= clock_timestamp()
    and a.expires_at > clock_timestamp();
  return found;
end;
$$;

create or replace function public.store_get_customer_session(
  p_session_hash text, p_shop_id text, p_client_id text, p_issuer text
) returns setof public.store_customer_sessions
language sql security invoker set search_path = '' as $$
  select s.* from public.store_customer_sessions s
  where s.session_hash = p_session_hash and s.shop_id = p_shop_id
    and s.client_id = p_client_id and s.issuer = p_issuer
    and s.revoked_at is null and s.created_at <= clock_timestamp()
    and s.expires_at > clock_timestamp();
$$;

-- Refresh never extends the absolute session lifetime or changes its identity.
create or replace function public.store_rotate_customer_session(
  p_session_hash text, p_shop_id text, p_client_id text, p_issuer text,
  p_expected_revision bigint, p_encrypted_tokens text, p_access_expires_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.store_customer_sessions s
  set encrypted_tokens = p_encrypted_tokens, access_expires_at = p_access_expires_at,
    revision = s.revision + 1, updated_at = clock_timestamp()
  where s.session_hash = p_session_hash and s.shop_id = p_shop_id
    and s.client_id = p_client_id and s.issuer = p_issuer
    and s.revision = p_expected_revision and s.revoked_at is null
    and s.created_at <= clock_timestamp() and s.expires_at > clock_timestamp()
    and p_access_expires_at > clock_timestamp();
  return found;
end;
$$;

create or replace function public.store_revoke_customer_session(
  p_session_hash text, p_shop_id text, p_client_id text, p_issuer text
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.store_customer_sessions s
  set revoked_at = clock_timestamp(), encrypted_tokens = null,
    revision = s.revision + 1, updated_at = clock_timestamp()
  where s.session_hash = p_session_hash and s.shop_id = p_shop_id
    and s.client_id = p_client_id and s.issuer = p_issuer and s.revoked_at is null;
  return found;
end;
$$;

revoke all on function public.store_get_customer_authorization(text,text,text,text,text,text),
  public.store_consume_customer_authorization(text,text,text,text,text,text),
  public.store_get_customer_session(text,text,text,text),
  public.store_rotate_customer_session(text,text,text,text,bigint,text,timestamptz),
  public.store_revoke_customer_session(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.store_get_customer_authorization(text,text,text,text,text,text),
  public.store_consume_customer_authorization(text,text,text,text,text,text),
  public.store_get_customer_session(text,text,text,text),
  public.store_rotate_customer_session(text,text,text,text,bigint,text,timestamptz),
  public.store_revoke_customer_session(text,text,text,text) to service_role;
notify pgrst, 'reload schema';
