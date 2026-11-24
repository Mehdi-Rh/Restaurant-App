# Restaurant-App — WhatsApp Order Template

> **Keep the "Current status" section up to date.** When a to-do is done or the state changes, edit it and update the date.

## What it is
A static website (no build step) for small restaurants and shops in Algeria.
- Customers browse a menu or catalog, build a cart, and send the order as a **WhatsApp message**.
- Shop owners manage the shop from their phone at `/admin.html`.
- **Multi-restaurant (branch `multi-restaurant`, PR #2):** one site, one Supabase project, many shops. Each shop is opened by its link `site/<slug>` and has its own brand. You (platform admin) manage all shops at `/platform.html`.

## Stack and files
- Plain HTML/CSS/JS, French + Arabic (RTL), currency DA
  - `index.html` + `app.js`: public menu/shop, cart, WhatsApp message, offline cache
  - `admin.html`: owner admin panel (see below)
  - `qr.html?shop=<slug>`: printable QR poster
  - `platform.html`: super-admin (create shop + owner login, suspend, paid-until, reset password)
  - `netlify/edge-functions/brand/`: per-shop title, preview card, icon, manifest
  - `supabase/functions/platform/`: edge function using the service role key (create owner, set password); `handler.js` is plain JS, tested under Node
  - `style.css`, `wilayas.js` (Algerian provinces), `lib/qrcode.js`
- `config.js`: Supabase URL, publishable key, `defaultShop` (the bare address redirects there), `baseDomain` (later, for subdomains). Only the publishable key may be in it, never a `service_role` / secret key.
- `demos/bahia-pizza/`, `demos/lina-style/`: static demos with no database
- `tools/config-to-sql.js <config.js> <shop-id>`: turns a demo config into seed SQL
- Hosting: Netlify (`netlify.toml`: publish ".", no build command)

## Admin panel (`admin.html`)
- Login: email and password, through Supabase Auth
- Tabs:
  - **Articles:** list items by category; sold-out switch; add, edit and delete items; options/variants with prices
  - **Catégories:** add, rename, reorder
  - **Boutique:** name, WhatsApp number, logo, colors, delivery zones and fees
- Photos: compressed on the phone (~100 KB, plus a ~20 KB thumbnail), then uploaded to the Storage bucket `photos/<shop-id>/…`

## Database (`supabase/schema.sql`, re-runnable)
- Tables:
  - `shops`: `id` text pk, `owner` → auth.users, `settings` jsonb
  - `categories`
  - `items`: price int, `variants` jsonb, flags available/popular/hidden, position
- Row Level Security:
  - Anyone can read.
  - Only the owner can write, through `is_shop_owner(shop_id)` (security definer).
  - Owners can update only `shops.settings`.
- Storage bucket `photos`: public, 400 KB limit, webp/jpeg/png. Only the owner can write to their folder.
- `create_shop(id, email, name, mode)`: admin-only function. It links an existing auth user to a shop. Re-running it re-assigns the owner.
- `supabase/test_rls.sql`: RLS tests, meant to run on a local Postgres
- `supabase/keepalive.yml`: GitHub Action that pings the database daily, so the free tier does not pause after 7 days without visits. It only runs from `.github/workflows/` on the default branch.
- Supabase project ref: `uotehbsqtjmpgrheusvk` (eu-west-1, free tier)

- Multi-restaurant additions: `shops.status`, `shops.paid_until` (closed shops: menu hidden by RLS), `platform_admins`, `is_platform_admin()` (also counts as owner of every shop), `domains`, `order_events` + `log_order()` / `order_stats()`, `platform_shops()`, `platform_update_shop()`, `platform_copy_menu()`. Reserved slugs: www, admin, platform, app, api, qr, demos, lib…
- `supabase/backup.yml`: weekly JSON backup workflow (copy to `.github/workflows/`).

## Tests
- `npm i playwright pngjs jsqr` (there is no package.json)
- `node tests/e2e.js`: tests the demos (cart, FR/AR, fees, WhatsApp message, QR, 3G speed). Last run: 75/75 on 2026-11-19.
- `node tests/e2e-live.js`: tests the admin + Supabase against a **mock** (`tests/mock-supabase.js`). Last run: 50/50 on 2026-11-19.
- `node tests/e2e-platform.js`: multi-restaurant (brands, links, previews, hours, platform page, closing). Last run: 64/64 on 2026-11-19.
- `sh tests/pg/run.sh`: runs `test_rls.sql` on a throwaway local Postgres 16. Last run: 39/39 on 2026-11-24.

## Current status (updated 2026-11-24)
- Git: work is on branch `supabase-admin`, pushed to GitHub. **Not merged into `main`.** `main` still has the old static version with no database.
- Live Supabase:
  - Schema applied ✅
  - Shop `bahia-pizza` seeded from the demo (5 categories, 16 items) ✅
  - Public read works, anonymous write is refused ✅
  - `touch_updated_at` search_path warning fixed ✅
- Still open:
  1. **0 auth users.** `bahia-pizza` has no owner, so nobody can log in to the admin yet. Fix: add a user (Authentication → Users), then run `select public.create_shop('bahia-pizza', '<email>', 'Bahia Pizza', 'menu');`
  2. The WhatsApp number is the demo placeholder `213500000000`. Set the real one in admin → Boutique.
  3. The admin was never tested against the **real** Supabase (login, edit, photo upload).
  4. Not deployed to Netlify yet. No real test order sent yet.
  5. Keepalive is not installed (it must be copied to `.github/workflows/keepalive.yml` on `main`).
  6. Merge `supabase-admin` into `main`.
  7. After PR #2 (`multi-restaurant`) is merged: re-run `schema.sql`, add yourself to `platform_admins`, deploy the `platform` edge function with verify JWT off. Then create owners from `/platform.html` instead of item 1.
- Known and accepted: the advisor warns that anon/authenticated can execute `is_shop_owner`. This is intentional, because RLS needs it and it only reveals whether the caller owns a shop.

## How to talk to the user
Follow the global rules: simple, short sentences, no jargon, as if the user is 12. English is not their first language.
