-- RLS tests: sh tests/pg/run.sh (local Postgres 16 + tests/pg/stub.sql). Every line must print "PASS".
\set QUIET on
\pset tuples_only on
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','a@x.dz'),('22222222-2222-2222-2222-222222222222','b@x.dz') on conflict do nothing;
select public.create_shop('shop-a','a@x.dz','Shop A');
select public.create_shop('shop-b','B@X.dz','Shop B','shop');
insert into public.items (shop_id, name, price) values ('shop-b','B item',100);

create or replace function pg_temp.t(name text, ok boolean) returns text language sql as $$ select (case when ok then 'PASS ' else 'FAIL ' end) || name $$;

-- anon
set role anon; set request.jwt.claims = '{}';
select pg_temp.t('anon reads items', (select count(*) from public.items) = 1);
do $$ begin insert into public.items (shop_id,name,price) values ('shop-a','hack',1); raise notice 'FAIL anon insert allowed'; exception when others then raise notice 'PASS anon cannot insert'; end $$;
-- owner A
reset role; set role authenticated; set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
insert into public.categories (shop_id,name) values ('shop-a','Pizzas');
insert into public.items (shop_id,name,price) values ('shop-a','Margherita',600);
select pg_temp.t('owner A inserts own item', (select count(*) from public.items where shop_id='shop-a') = 1);
do $$ begin insert into public.items (shop_id,name,price) values ('shop-b','x',1); raise notice 'FAIL A inserted into B'; exception when others then raise notice 'PASS A cannot insert into B'; end $$;
update public.items set price = 1 where shop_id='shop-b';
delete from public.items where shop_id='shop-b';
update public.shops set settings = '{"hacked":true}' where id='shop-b';
update public.shops set settings = jsonb_set(settings,'{business,whatsapp}','"213555000000"') where id='shop-a';
do $$ begin update public.shops set owner = '11111111-1111-1111-1111-111111111111' where id='shop-a'; raise notice 'FAIL owner column writable'; exception when others then raise notice 'PASS owner column locked'; end $$;
do $$ begin insert into public.shops (id) values ('new-shop'); raise notice 'FAIL client created shop'; exception when others then raise notice 'PASS client cannot create shops'; end $$;
do $$ begin perform public.create_shop('zz','a@x.dz','x'); raise notice 'FAIL client ran create_shop'; exception when others then raise notice 'PASS create_shop is admin-only'; end $$;
insert into storage.objects (bucket_id,name) values ('photos','shop-a/p1.webp');
do $$ begin insert into storage.objects (bucket_id,name) values ('photos','shop-b/p1.webp'); raise notice 'FAIL A uploaded into B folder'; exception when others then raise notice 'PASS A cannot upload into B folder'; end $$;
reset role;
select pg_temp.t('B item untouched by A', (select price from public.items where shop_id='shop-b') = 100);
select pg_temp.t('B settings untouched by A', (select not (settings ? 'hacked') from public.shops where id='shop-b'));
select pg_temp.t('A settings updated', (select settings->'business'->>'whatsapp' from public.shops where id='shop-a') = '213555000000');
select pg_temp.t('A photo stored', (select count(*) from storage.objects where name='shop-a/p1.webp') = 1);
select pg_temp.t('bucket is public with size limit', (select public and file_size_limit=400000 from storage.buckets where id='photos'));

-- ---------- multi-restaurant platform ----------
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999','mehdi@x.dz') on conflict do nothing;
insert into public.platform_admins values ('99999999-9999-9999-9999-999999999999') on conflict do nothing;
do $$ begin insert into public.shops (id) values ('admin'); raise notice 'FAIL reserved slug accepted'; exception when others then raise notice 'PASS reserved slug refused'; end $$;
-- owner A cannot use platform tools
set role authenticated; set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
do $$ begin perform * from public.platform_shops(); raise notice 'FAIL owner listed all shops'; exception when others then raise notice 'PASS owner cannot list all shops'; end $$;
do $$ begin perform public.platform_update_shop('shop-b','suspended',null); raise notice 'FAIL owner suspended a shop'; exception when others then raise notice 'PASS owner cannot suspend shops'; end $$;
do $$ begin update public.shops set status = 'suspended' where id = 'shop-a'; raise notice 'FAIL owner changed own status'; exception when others then raise notice 'PASS owner cannot change own status'; end $$;
select pg_temp.t('owner is not platform admin', not public.is_platform_admin());
-- platform admin
reset role; set role authenticated; set request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999"}';
select pg_temp.t('admin lists all shops', (select count(*) from public.platform_shops()) = 2);
select pg_temp.t('admin sees owner email', (select owner_email from public.platform_shops() where id='shop-b') = 'b@x.dz');
insert into public.items (shop_id,name,price) values ('shop-b','Added by Mehdi',50);
select pg_temp.t('admin edits any shop items', (select count(*) from public.items where shop_id='shop-b') = 2);
update public.shops set settings = jsonb_set(settings,'{business,tagline}','"by admin"') where id='shop-b';
select pg_temp.t('admin edits any shop settings', (select settings->'business'->>'tagline' from public.shops where id='shop-b') = 'by admin');
insert into storage.objects (bucket_id,name) values ('photos','shop-b/admin.webp');
select pg_temp.t('admin uploads into any shop folder', true);
select public.platform_update_shop('shop-b','suspended',null);
reset role;
select pg_temp.t('admin suspended B', (select status from public.shops where id='shop-b') = 'suspended');
-- suspended shop: public sees the shop row (for the closed page) but no menu
set role anon; set request.jwt.claims = '{}';
select pg_temp.t('suspended: shop row visible', (select count(*) from public.shops where id='shop-b') = 1);
select pg_temp.t('suspended: menu hidden from public', (select count(*) from public.items where shop_id='shop-b') = 0);
select pg_temp.t('open shop menu still public', (select count(*) from public.items where shop_id='shop-a') = 1);
select public.log_order('shop-b', 1000);
select public.log_order('shop-a', 1500);
select public.log_order('shop-a', 900);
do $$ begin perform * from public.order_events; raise notice 'FAIL anon reads order events'; exception when others then raise notice 'PASS anon cannot read order events'; end $$;
-- owner B still sees its own menu while suspended
reset role; set role authenticated; set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
select pg_temp.t('suspended: owner still sees own menu', (select count(*) from public.items where shop_id='shop-b') = 2);
-- order stats
reset role; set role authenticated; set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
select pg_temp.t('owner A order stats', (public.order_stats('shop-a')->>'week')::int = 2 and (public.order_stats('shop-a')->>'month_total')::int = 2400);
do $$ begin perform public.order_stats('shop-b'); raise notice 'FAIL A read B stats'; exception when others then raise notice 'PASS A cannot read B stats'; end $$;
reset role;
select pg_temp.t('closed shop orders not counted', (select count(*) from public.order_events where shop_id='shop-b') = 0);
-- paid_until in the past closes the shop
update public.shops set status='active', paid_until = current_date - 1 where id='shop-b';
select pg_temp.t('expired paid_until closes shop', not public.shop_open('shop-b'));
update public.shops set paid_until = current_date where id='shop-b';
select pg_temp.t('paid until today still open', public.shop_open('shop-b'));
-- copy menu
update public.items set category_id = (select id from public.categories where shop_id='shop-a') where shop_id='shop-a';
insert into public.shops (id, owner, settings) values ('shop-c', null, '{}');
set role authenticated; set request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999"}';
select public.platform_copy_menu('shop-a','shop-c');
reset role;
select pg_temp.t('copy menu: items copied', (select count(*) from public.items where shop_id='shop-c') = 1);
select pg_temp.t('copy menu: category remapped', (select c.shop_id from public.items i join public.categories c on c.id=i.category_id where i.shop_id='shop-c') = 'shop-c');
select pg_temp.t('copy menu: source untouched', (select count(*) from public.items where shop_id='shop-a') = 1);
-- domains
insert into public.domains values ('menu.shop-a.dz','shop-a');
set role anon; set request.jwt.claims = '{}';
select pg_temp.t('anon resolves custom domain', (select shop_id from public.domains where host='menu.shop-a.dz') = 'shop-a');
do $$ begin insert into public.domains values ('evil.dz','shop-a'); raise notice 'FAIL anon added domain'; exception when others then raise notice 'PASS anon cannot add domains'; end $$;
reset role;
