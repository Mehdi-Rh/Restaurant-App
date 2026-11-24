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

-- ---------- helper: is the logged-in user the owner of this shop? ----------
create or replace function public.is_shop_owner(p_shop text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops s where s.id = p_shop and s.owner = auth.uid());
$$;

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
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
create policy "public read categories" on public.categories for select using (true);
drop policy if exists "public read items" on public.items;
create policy "public read items" on public.items for select using (true);

-- owners edit only their own shop
drop policy if exists "owner updates shop" on public.shops;
create policy "owner updates shop" on public.shops for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

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
