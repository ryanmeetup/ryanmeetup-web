begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid='public.store_customer_authorizations'::regclass),'authorization rows have RLS');
select ok((select relrowsecurity from pg_class where oid='public.store_customer_sessions'::regclass),'session rows have RLS');
select ok(not has_table_privilege('anon','public.store_customer_authorizations','select'),'anonymous clients cannot read verifiers');
select ok(not has_table_privilege('authenticated','public.store_customer_sessions','select'),'Tasks members cannot read buyer sessions');
select ok(not has_table_privilege('authenticated','public.store_customer_authorizations','insert'),'Tasks members cannot create authorizations');
select ok(has_table_privilege('service_role','public.store_customer_sessions','select,insert,update,delete'),'backend grants are explicit');
select is_empty($$select p.proname::text from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'store_%customer_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))$$,'store auth RPCs are backend-only');
select is_empty($$select p.proname::text from pg_proc p where p.pronamespace='public'::regnamespace and p.proname like 'store_%customer_%' and p.prosecdef$$,'auth functions cannot elevate a caller');

create function pg_temp.authorization_args() returns text[] language sql as $$select array[repeat('a',64),repeat('b',64),'123','client','https://shopify.com/authentication/123','https://store.test/api/reviews/auth/callback']$$;
create function pg_temp.flow(s text,b text,shop text default '123',client text default 'client',created timestamptz default now()) returns void language sql as $$
  insert into public.store_customer_authorizations(state_hash,browser_binding_hash,shop_id,client_id,issuer,redirect_uri,encrypted_flow,created_at,expires_at)
  values(s,b,shop,client,'https://shopify.com/authentication/'||shop,'https://store.test/api/reviews/auth/callback','v1.test.'||repeat('a',48),created,created+interval '10 minutes');
$$;
create function pg_temp.get_flow(s text default repeat('a',64),b text default repeat('b',64),shop text default '123',client text default 'client') returns bigint language sql as $$
  select count(*) from public.store_get_customer_authorization(s,b,shop,client,'https://shopify.com/authentication/'||shop,'https://store.test/api/reviews/auth/callback');
$$;
create function pg_temp.consume(s text default repeat('a',64),b text default repeat('b',64),shop text default '123',client text default 'client') returns boolean language sql as $$
  select public.store_consume_customer_authorization(s,b,shop,client,'https://shopify.com/authentication/'||shop,'https://store.test/api/reviews/auth/callback');
$$;

select pg_temp.flow(repeat('a',64),repeat('b',64));
select is(pg_temp.get_flow(),1::bigint,'correct browser and shop can load an unexpired flow');
select is(pg_temp.get_flow(b=>repeat('c',64)),0::bigint,'wrong browser cannot load a flow');
select is(pg_temp.get_flow(shop=>'999'),0::bigint,'wrong shop cannot load a flow');
select is(pg_temp.get_flow(client=>'other'),0::bigint,'wrong client cannot load a flow');
select ok(not pg_temp.consume(b=>repeat('c',64)),'wrong browser cannot consume a flow');
select ok(not pg_temp.consume(shop=>'999'),'wrong shop cannot consume a flow');
select ok(pg_temp.consume(),'a correct authorization is consumed');
select ok(not pg_temp.consume(),'authorization cannot be consumed twice');
select is(pg_temp.get_flow(),0::bigint,'consumed flow is unavailable');
select ok((select encrypted_flow is null and consumed_at is not null from public.store_customer_authorizations where state_hash=repeat('a',64)),'consumption erases the verifier envelope but retains a replay tombstone');
select throws_ok($$select pg_temp.flow(repeat('a',64),repeat('b',64))$$,'23505',null,'a retry cannot recreate the consumed state');
select pg_temp.flow(repeat('c',64),repeat('d',64),'123','client',now()-interval '11 minutes');
select is(pg_temp.get_flow(repeat('c',64),repeat('d',64)),0::bigint,'expired flow cannot load');
select ok(not pg_temp.consume(repeat('c',64),repeat('d',64)),'expired flow cannot be consumed');
select pg_temp.flow(repeat('e',64),repeat('f',64),'123','client',now()+interval '1 minute');
select is(pg_temp.get_flow(repeat('e',64),repeat('f',64)),0::bigint,'future flow cannot load early');
select throws_ok($$insert into public.store_customer_authorizations(state_hash,browser_binding_hash,shop_id,client_id,issuer,redirect_uri,encrypted_flow) values(repeat('1',64),repeat('2',64),'123','client','https://shopify.com/authentication/999','https://store.test/api/reviews/auth/callback','v1.test.'||repeat('a',48))$$,'23514',null,'issuer must match the stored shop');
select throws_ok($$insert into public.store_customer_authorizations(state_hash,browser_binding_hash,shop_id,client_id,issuer,redirect_uri,encrypted_flow) values(repeat('1',64),repeat('2',64),'123','client','https://shopify.com/authentication/123','https://store.test/api/reviews/auth/callback','plaintext-verifier')$$,'23514',null,'plain-text flow secrets are rejected');

insert into public.store_customer_sessions(session_hash,shop_id,client_id,issuer,subject,encrypted_tokens,access_expires_at,expires_at)
values(repeat('1',64),'123','client','https://shopify.com/authentication/123','buyer-subject','v1.test.'||repeat('a',48),now()+interval '1 hour',now()+interval '1 day');
select is((select count(*) from public.store_get_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123')),1::bigint,'a backend loads an active session in the correct scope');
select is((select count(*) from public.store_get_customer_session(repeat('1',64),'999','client','https://shopify.com/authentication/999')),0::bigint,'session reads cannot cross shops');
select is((select count(*) from public.store_get_customer_session(repeat('1',64),'123','other','https://shopify.com/authentication/123')),0::bigint,'session reads cannot cross clients');
select ok(not public.store_rotate_customer_session(repeat('1',64),'999','client','https://shopify.com/authentication/999',0,'v1.test.'||repeat('b',48),now()+interval '2 hours'),'wrong shop cannot refresh a session');
select ok(public.store_rotate_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123',0,'v1.test.'||repeat('b',48),now()+interval '2 hours'),'current session revision refreshes');
select ok(not public.store_rotate_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123',0,'v1.test.'||repeat('c',48),now()+interval '3 hours'),'stale refresh cannot overwrite newer tokens');
select is((select revision from public.store_customer_sessions where session_hash=repeat('1',64)),1::bigint,'refresh increments the version exactly once');
select ok((select subject='buyer-subject' and expires_at=now()+interval '1 day' from public.store_customer_sessions where session_hash=repeat('1',64)),'refresh preserves buyer and absolute lifetime');
select ok(public.store_revoke_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123'),'logout revokes the session');
select ok(not public.store_revoke_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123'),'logout retry has no additional effect');
select is((select count(*) from public.store_get_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123')),0::bigint,'revoked session cannot load');
select ok(not public.store_rotate_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123',2,'v1.test.'||repeat('d',48),now()+interval '4 hours'),'refresh cannot revive a revoked session');
select ok((select encrypted_tokens is null from public.store_customer_sessions where session_hash=repeat('1',64)),'logout erases the token envelope');
select is((select count(*) from auth.users),0::bigint,'store identities create no Supabase Auth users');
select is((select count(*) from public.profiles),0::bigint,'store identities create no Tasks profiles');

set local role anon;
select throws_ok($$select * from public.store_customer_sessions$$,'42501',null,'anonymous reads fail at the database boundary');
select throws_ok($$select public.store_get_customer_session(repeat('1',64),'123','client','https://shopify.com/authentication/123')$$,'42501',null,'anonymous callers cannot invoke a session RPC');
set local role authenticated;
select throws_ok($$select * from public.store_customer_authorizations$$,'42501',null,'authenticated Tasks users cannot read authorization secrets');
set local role postgres;
select * from finish();
rollback;
