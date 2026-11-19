# WhatsApp Order Template

One site for all your restaurants and shops. Each one gets its own link (`yoursite.netlify.app/bahia-pizza`), name, logo, colors, style and link preview. The customer picks items and the order arrives on WhatsApp.
Owners edit their menu from their phone (`/admin.html`). You manage every restaurant from `/platform.html`. Data lives in Supabase (free tier).

**Demos (no database):** `demos/bahia-pizza/` · `demos/lina-style/`

## One-time setup (you, ~20 min)

1. **Supabase → SQL Editor:** paste [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It is safe to re-run, so run it again after each update.
2. **Make yourself the platform admin.** First create your login in **Authentication → Users → Add user** (tick *Auto confirm*). Then run:
   ```sql
   insert into public.platform_admins select id from auth.users where email = 'you@mail.com';
   ```
3. **Deploy the `platform` Edge Function.** In Claude Code (Supabase connected), ask: *"deploy supabase/functions/platform as the edge function `platform` with verify_jwt off"*. If you use the dashboard instead, go to **Edge Functions → Deploy a new function**, name it `platform`, add both files from `supabase/functions/platform/`, and turn off *Verify JWT*.
4. **Netlify → Add new site → Import from Git:** pick the repo and click **Deploy**. `netlify.toml` already sets up the links and link previews.
5. **GitHub → Add file → Create new file:** copy `supabase/keepalive.yml` to `.github/workflows/keepalive.yml`, then copy `supabase/backup.yml` to `.github/workflows/backup.yml`.

`config.js` holds only the Supabase URL and publishable key. *Never* put the secret key anywhere.

## New restaurant (~5 min)

1. Open `/platform.html` and click **➕ Nouveau restaurant**. Enter the name, email and type. You can copy the menu of an existing restaurant.
2. Send the ready-made message to the client on WhatsApp. It has their link, admin login and password.
3. The client fills in **Boutique** (WhatsApp number!) and the **Articles**.
4. Print the QR poster from the **📱 QR** button.

From the same page you can suspend a restaurant, set a "paid until" date (the menu closes by itself after that date), reset a password, and edit any menu.

## What the owner does (admin)

- **Articles:** a switch for sold out, a tap to edit, and **+** to add an item with a photo. At the top they see orders today, this week and this month.
- **Catégories:** add, rename and reorder.
- **Boutique:** name, WhatsApp, logo, cover photo, style (Classique, Sombre, Street food, Élégant), colors, opening hours (shows "Fermé" and blocks orders when closed), social links, delivery zones and fees.

## Good to know

- **Free first.** Everything runs on free plans. Upgrade only at these thresholds:
  - A domain (about $10 a year) at 10 paying restaurants.
  - Supabase Pro (about $25 a month) when egress passes 70% or storage passes 800 MB.
- **Later, your own domain:** set `baseDomain: "yoursite.com"` in `config.js` to get `bahia-pizza.yoursite.com`. A restaurant's own domain works too. Add it in Netlify, then run `insert into public.domains values ('menu.bahia.dz', 'bahia-pizza');`
- **Backups:** every Monday, `backups/shops.json` is updated in the repo. Add the GitHub secret `SUPABASE_SECRET_KEY` so closed shops are included too.
- **Security:** an owner can only edit their own shop. Only you can see all shops or close them. The database rules in `schema.sql` enforce this.

## Tests

```
npm i playwright pngjs jsqr
node tests/e2e.js            # demos: cart, FR/AR, fees, WhatsApp message, QR, 3G speed
node tests/e2e-live.js       # admin + Supabase (simulated): login, photos, options, security
node tests/e2e-platform.js   # many restaurants: brands, links, previews, hours, platform page, closing
sh tests/pg/run.sh           # database rules on a local Postgres 16
```
