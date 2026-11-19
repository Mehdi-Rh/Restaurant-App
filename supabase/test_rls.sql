-- RLS tests: run against a local Postgres with Supabase stubs (see tests/README). Every line must print "PASS".
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
