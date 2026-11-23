begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid='public.store_review_suggestion_dismissals'::regclass), 'dismissals have RLS');
select ok(not has_table_privilege('anon','public.store_review_suggestion_dismissals','select,insert,update,delete'), 'anon cannot reach dismissals');
select ok(not has_table_privilege('authenticated','public.store_review_suggestion_dismissals','select,insert,update,delete'), 'Tasks members cannot reach buyer preferences');
select ok(has_table_privilege('service_role','public.store_review_suggestion_dismissals','select,insert,delete'), 'Store server can read, dismiss and restore');

set local role service_role;
insert into public.store_review_suggestion_dismissals(shop_id, customer_subject, line_id)
values ('123','buyer-a','101'), ('123','buyer-b','101'), ('124','buyer-a','101');
insert into public.store_review_suggestion_dismissals(shop_id, customer_subject, line_id)
values ('123','buyer-a','101') on conflict do nothing;
select is((select count(*) from public.store_review_suggestion_dismissals), 3::bigint, 'duplicate dismissals are idempotent and identities stay separate');
delete from public.store_review_suggestion_dismissals where shop_id='123' and customer_subject='buyer-a' and line_id='101';
select is((select count(*) from public.store_review_suggestion_dismissals), 2::bigint, 'restoring one preference retains the other buyer and shop');
select is((select count(*) from public.store_review_suggestion_dismissals where line_id='102'), 0::bigint, 'new purchases have no inherited dismissal');
select throws_ok($$insert into public.store_review_suggestion_dismissals values ('123','buyer-a','bad',now())$$, '23514', null, 'invalid purchase references are rejected');

select * from finish();
rollback;
