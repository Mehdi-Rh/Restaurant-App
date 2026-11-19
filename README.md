# WhatsApp Order Template

A menu or catalog site. The customer picks items and the order arrives on WhatsApp.
The client edits items and photos from their phone (`/admin.html`). The data lives in Supabase (free tier).

**Demos (no database):** `demos/bahia-pizza/` · `demos/lina-style/`

## One-time setup (you, ~10 min)

1. On **supabase.com**, create a new project. Pick the region closest to Algeria (Paris or Frankfurt).
2. Open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. Get your **Project URL** and **anon public key** from **Project Settings → API**.
   *Never* put the `service_role` key anywhere.

One Supabase project holds all your clients.

## New client (~15 min)

1. Go to **Supabase → Authentication → Users → Add user**. Enter the client's email and a password, and tick *Auto confirm*.
2. In the **SQL Editor**, run:
   ```sql
   select public.create_shop('pizza-oran', 'client@email.com', 'Pizza Oran', 'menu');  -- or 'shop'
   ```
3. Copy this repo (use it as a template on GitHub), then edit `config.js`:
   ```js
   window.CONFIG = { supabase: { url: "https://xxxx.supabase.co", key: "anon-key" }, shop: "pizza-oran" };
   ```
4. In **Netlify → Add new site → Import from Git**, pick the repo and click **Deploy**. Every push redeploys it.
5. Open `site/admin.html`, log in as the client, and fill **Boutique** (WhatsApp number!) and the **Articles**.
6. Print the QR poster from `site/qr.html`. Send yourself a test order.

**Shortcut:** load demo data into a shop:
`node tools/config-to-sql.js demos/bahia-pizza/config.js pizza-oran > seed.sql`, then paste it in the SQL Editor.

## What the client does (admin)

- **Articles:** tap the switch to mark an item sold out. Tap the item to edit it, or **+** to add one with a photo taken by the phone.
- **Catégories:** add, rename and reorder.
- **Boutique:** name, WhatsApp, logo, colors, delivery zones and fees.

Photos are compressed on the phone, to about 100 KB plus a 20 KB thumbnail. The free tier's 1 GB holds about 8,000 photos.

## Good to know

- **Free Supabase pauses after 7 days without visits.** To prevent it, copy `supabase/keepalive.yml` to `.github/workflows/keepalive.yml` (GitHub → Add file → Create new file). It then pings the database daily.
- The menu is cached on customers' phones, so return visits open instantly, even offline.
- Security: a client can only edit their own shop and photos. This is enforced by the database rules in `schema.sql`.

## Tests

```
npm i playwright pngjs jsqr
node tests/e2e.js        # demos: cart, FR/AR, fees, WhatsApp message, QR, 3G speed
node tests/e2e-live.js   # admin + Supabase (simulated): login, photos, options, security
```
The database rules are tested with `supabase/test_rls.sql` on a local Postgres.
