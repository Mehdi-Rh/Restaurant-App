-- ============================================================
--  WhatsApp Order Template — Supabase schema
--  Paste this whole file in Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================

-- ---------- tables ----------
create table if not exists public.shops (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  owner       uuid references auth.users(id) on delete set null,
  settings    jsonb not null default '{}'::jsonb,   -- name, whatsapp, colors, delivery, mode…
  updated_at  timestamptz not null default now()
);

create table if not exists public.categories (
  id        uuid primary key default gen_random_uuid(),
  shop_id   text not null references public.shops(id) on delete cascade,
  name      text not null check (length(name) between 1 and 60),
  name_ar   text,
  icon      text,
  position  int not null default 0
);
create index if not exists categories_shop_idx on public.categories(shop_id, position);

create table if not exists public.items (
  id              uuid primary key default gen_random_uuid(),
  shop_id         text not null references public.shops(id) on delete cascade,
  category_id     uuid references public.categories(id) on delete set null,
  name            text not null check (length(name) between 1 and 80),
  name_ar         text,
  description     text,
  description_ar  text,
  price           int  not null default 0 check (price >= 0 and price < 10000000),
  photo           text,
  emoji           text,
  variants        jsonb not null default '[]'::jsonb,
  available       boolean not null default true,
  popular         boolean not null default false,
  hidden          boolean not null default false,
  position        int not null default 0,
  updated_at      timestamptz not null default now()
);
create index if not exists items_shop_idx on public.items(shop_id, position);

-- ---------- platform: you (the seller) and shop status ----------
alter table public.shops add column if not exists status     text not null default 'active';
alter table public.shops add column if not exists paid_until date;
alter table public.shops add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table public.shops add constraint shops_status_chk check (status in ('active','suspended'));
exception when duplicate_object then null; end $$;
do $$ begin  -- reserved words can't be shop links
  alter table public.shops add constraint shops_reserved_chk check (id not in ('www','admin','platform','app','api','qr','demos','lib','assets','static','index','config','backups','supabase'));
exception when duplicate_object then null; end $$;

-- platform admins = you. Add yourself once: insert into public.platform_admins select id from auth.users where email = 'you@mail.com';
create table if not exists public.platform_admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.platform_admins enable row level security;
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- custom domains (optional, later): menu.bahiapizza.dz → bahia-pizza
create table if not exists public.domains (
  host    text primary key check (host = lower(host)),
  shop_id text not null references public.shops(id) on delete cascade on update cascade
);

-- ---------- helper: may the logged-in user edit this shop? (its owner, or you) ----------
create or replace function public.is_shop_owner(p_shop text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops s where s.id = p_shop and s.owner = auth.uid())
      or exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- a shop is open when active and not past its paid_until date (no paid_until = always open)
create or replace function public.shop_open(p_shop text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops s where s.id = p_shop and s.status = 'active'
                 and (s.paid_until is null or s.paid_until >= current_date));
$$;

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();
drop trigger if exists shops_touch on public.shops;
create trigger shops_touch before update on public.shops for each row execute function public.touch_updated_at();

-- ---------- security (Row Level Security) ----------
alter table public.shops      enable row level security;
alter table public.categories enable row level security;
alter table public.items      enable row level security;

-- everyone can read menus
drop policy if exists "public read shops" on public.shops;
create policy "public read shops" on public.shops for select using (true);
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select using (public.shop_open(shop_id) or public.is_shop_owner(shop_id));
drop policy if exists "public read items" on public.items;
create policy "public read items" on public.items for select using (public.shop_open(shop_id) or public.is_shop_owner(shop_id));

-- owners edit only their own shop
drop policy if exists "owner updates shop" on public.shops;
create policy "owner updates shop" on public.shops for update to authenticated
  using (public.is_shop_owner(id)) with check (public.is_shop_owner(id));

drop policy if exists "owner writes categories" on public.categories;
create policy "owner writes categories" on public.categories for all to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

drop policy if exists "owner writes items" on public.items;
create policy "owner writes items" on public.items for all to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

-- table privileges (owners may only change `settings` on their shop, never id/owner)
revoke all on public.shops, public.categories, public.items from anon, authenticated;
grant select on public.shops, public.categories, public.items to anon, authenticated;
grant update (settings) on public.shops to authenticated;
grant insert, update, delete on public.categories, public.items to authenticated;
grant execute on function public.is_shop_owner(text) to anon, authenticated;
grant execute on function public.shop_open(text), public.is_platform_admin() to anon, authenticated;

alter table public.domains enable row level security;
drop policy if exists "public read domains" on public.domains;
create policy "public read domains" on public.domains for select using (true);
drop policy if exists "platform writes domains" on public.domains;
create policy "platform writes domains" on public.domains for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
revoke all on public.domains, public.platform_admins from anon, authenticated;
grant select on public.domains to anon, authenticated;
grant insert, update, delete on public.domains to authenticated;
drop policy if exists "admin sees itself" on public.platform_admins;
create policy "admin sees itself" on public.platform_admins for select to authenticated using (user_id = auth.uid());
grant select on public.platform_admins to authenticated;

-- ---------- photo storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 400000, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 400000,
  allowed_mime_types = array['image/webp','image/jpeg','image/png'];

-- files live in photos/<shop-id>/… ; only that shop's owner can write there
drop policy if exists "owner uploads photos" on storage.objects;
create policy "owner uploads photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_shop_owner((storage.foldername(name))[1]));
drop policy if exists "owner updates photos" on storage.objects;
create policy "owner updates photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_shop_owner((storage.foldername(name))[1]));
drop policy if exists "owner deletes photos" on storage.objects;
create policy "owner deletes photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_shop_owner((storage.foldername(name))[1]));

-- ---------- for YOU (run in SQL editor): create a client's shop ----------
-- 1) Authentication → Users → Add user (email + password, tick "Auto confirm")
-- 2) select public.create_shop('bahia-pizza', 'client@email.com', 'Bahia Pizza', 'menu');
create or replace function public.create_shop(p_id text, p_email text, p_name text, p_mode text default 'menu')
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'No user with email % — create it in Authentication → Users first', p_email; end if;
  insert into public.shops (id, owner, settings)
  values (p_id, uid, jsonb_build_object(
    'mode', p_mode, 'lang', 'fr', 'languages', jsonb_build_array('fr','ar'),
    'currency', 'DA', 'currency_ar', 'دج',
    'business', jsonb_build_object('name', p_name, 'logo', case when p_mode = 'shop' then '🛍️' else '🍽️' end, 'whatsapp', ''),
    'colors', jsonb_build_object('primary', '#c1121f', 'accent', '#f77f00'),
    'delivery', jsonb_build_object('wilayas', jsonb_build_array(), 'freeAbove', 0, 'minOrder', 0,
       'options', jsonb_build_array(jsonb_build_object('id','home','label','Livraison','label_ar','توصيل','fee',0,'address',true)))))
  on conflict (id) do update set owner = excluded.owner;
  return 'OK: shop ' || p_id || ' → ' || p_email;
end $$;
revoke all on function public.create_shop(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_shop(text, text, text, text) to service_role;

-- ============================================================
--  Platform tools (used by /platform.html, only for platform admins)
-- ============================================================
create or replace function public.platform_shops()
returns table (id text, name text, owner_email text, status text, paid_until date, open boolean,
               items bigint, orders_7d bigint, updated_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'platform admins only'; end if;
  return query
    select s.id, s.settings->'business'->>'name', u.email::text, s.status, s.paid_until, public.shop_open(s.id),
           (select count(*) from public.items i where i.shop_id = s.id),
           (select count(*) from public.order_events o where o.shop_id = s.id and o.at > now() - interval '7 days'),
           s.updated_at, s.created_at
    from public.shops s left join auth.users u on u.id = s.owner
    order by s.created_at desc;
end $$;

create or replace function public.platform_update_shop(p_id text, p_status text, p_paid_until date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'platform admins only'; end if;
  update public.shops set status = p_status, paid_until = p_paid_until where id = p_id;
end $$;

-- copy categories + items from one shop into another (photos keep pointing at the source files)
create or replace function public.platform_copy_menu(p_from text, p_to text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_platform_admin() then raise exception 'platform admins only'; end if;
  create temp table _map on commit drop as
    select id as old_id, gen_random_uuid() as new_id from public.categories where shop_id = p_from;
  insert into public.categories (id, shop_id, name, name_ar, icon, position)
    select m.new_id, p_to, c.name, c.name_ar, c.icon, c.position from public.categories c join _map m on m.old_id = c.id;
  insert into public.items (shop_id, category_id, name, name_ar, description, description_ar, price, photo, emoji, variants, available, popular, hidden, position)
    select p_to, m.new_id, i.name, i.name_ar, i.description, i.description_ar, i.price, i.photo, i.emoji, i.variants, i.available, i.popular, i.hidden, i.position
    from public.items i left join _map m on m.old_id = i.category_id where i.shop_id = p_from;
  get diagnostics n = row_count;
  update public.shops t set settings = t.settings || jsonb_build_object(
      'colors', f.settings->'colors', 'theme', f.settings->'theme', 'delivery', f.settings->'delivery')
    from public.shops f where f.id = p_from and t.id = p_to;
  return n;
end $$;

revoke all on function public.platform_shops(), public.platform_update_shop(text, text, date), public.platform_copy_menu(text, text) from public, anon;
grant execute on function public.platform_shops(), public.platform_update_shop(text, text, date), public.platform_copy_menu(text, text) to authenticated;

-- ============================================================
--  Order counter: one row per "Envoyer sur WhatsApp" tap (no customer data)
-- ============================================================
create table if not exists public.order_events (
  id      bigint generated always as identity primary key,
  shop_id text not null references public.shops(id) on delete cascade on update cascade,
  total   int,
  at      timestamptz not null default now()
);
create index if not exists order_events_shop_idx on public.order_events(shop_id, at);
alter table public.order_events enable row level security;
revoke all on public.order_events from anon, authenticated;

create or replace function public.log_order(p_shop text, p_total int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.shop_open(p_shop) then return; end if;
  -- simple flood guard: at most 300 taps per shop per hour
  if (select count(*) from public.order_events where shop_id = p_shop and at > now() - interval '1 hour') >= 300 then return; end if;
  insert into public.order_events (shop_id, total) values (p_shop, greatest(0, least(coalesce(p_total, 0), 10000000)));
end $$;

create or replace function public.order_stats(p_shop text)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_shop_owner(p_shop) then raise exception 'not your shop'; end if;
  return (select json_build_object(
    'today', count(*) filter (where at >= date_trunc('day', now())),
    'week',  count(*) filter (where at > now() - interval '7 days'),
    'month', count(*) filter (where at > now() - interval '30 days'),
    'month_total', coalesce(sum(total) filter (where at > now() - interval '30 days'), 0))
    from public.order_events where shop_id = p_shop);
end $$;
revoke all on function public.log_order(text, int), public.order_stats(text) from public;
grant execute on function public.log_order(text, int) to anon, authenticated;
grant execute on function public.order_stats(text) to authenticated;
