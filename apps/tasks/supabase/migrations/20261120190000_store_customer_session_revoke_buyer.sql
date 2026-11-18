-- Revoke every live review session for one buyer, RMT only. For a compromised
-- buyer account or a support request, run from the RMT SQL Editor:
--   select public.store_revoke_customer_buyer_sessions('<shop id>', '<client id>',
--     'https://shopify.com/authentication/<shop id>', '<OIDC subject>');
-- It returns how many sessions it ended. Each one is cleared exactly like a
-- single sign-out: tokens dropped, revision bumped so in-flight renewals lose.

create or replace function public.store_revoke_customer_buyer_sessions(
  p_shop_id text, p_client_id text, p_issuer text, p_subject text
) returns integer language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
  update public.store_customer_sessions s
  set revoked_at = clock_timestamp(), encrypted_tokens = null,
    revision = s.revision + 1, updated_at = clock_timestamp()
  where s.shop_id = p_shop_id and s.client_id = p_client_id and s.issuer = p_issuer
    and s.subject = p_subject and s.revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create index if not exists store_customer_sessions_subject
  on public.store_customer_sessions (shop_id, subject) where revoked_at is null;

revoke all on function public.store_revoke_customer_buyer_sessions(text,text,text,text) from public, anon, authenticated;
grant execute on function public.store_revoke_customer_buyer_sessions(text,text,text,text) to service_role;
notify pgrst, 'reload schema';
