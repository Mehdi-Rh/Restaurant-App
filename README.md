# WhatsApp Order Template

A menu or catalog site. The customer picks items and taps a button, and the order arrives on WhatsApp.
No backend and no fees. About 45 KB, loads in about 2 s on slow 3G.

**Demos:** `demos/bahia-pizza/` (restaurant) · `demos/lina-style/` (clothing shop)

## Files

| File | What it is |
|---|---|
| `config.js` | **The only file you edit per client** |
| `index.html` | The shop page (edit only the `<title>`) |
| `admin.html` | Client edits items/prices → exports a new `config.js` |
| `qr.html` | Printable QR poster for the client's link |
| `app.js`, `style.css`, `wilayas.js`, `lib/` | Don't touch |

## New client in ~30 min

1. **Copy** this folder → `client-name/`. Delete `demos/` and `tests/`.
2. **Open `admin.html`** locally (double-click it, or run `npx serve`).
   - Commerce: name, WhatsApp (`213…`, without the `0`), logo, colors.
   - Type: *Restaurant* or *Boutique*.
   - Untick **Mode démo**.
   - Livraison: leave wilayas empty for all 58, or put `31` for Oran only. Set fees (`16=500, 31=400`).
   - Categories and items: name, price, photo, options.
3. Click **Aperçu** to check, then **Exporter**. Replace `config.js` in the folder.
4. Edit the `<title>` in `index.html` (it shows in link previews).
5. **Deploy** (see below), then open `your-site/qr.html` to download the QR poster.
6. Send the client a test order from your phone.

### Item options (admin, one line per group)

```
Taille: M=600, L=900          → "=" sets the price
Sauce: Algérienne, Blanche    → free choice
Suppléments*: Fromage+80      → "*" allows several, "+" adds to the price
Couleur: Noir|أسود #111111    → "|" Arabic label, "#" color dot
XL!                           → "!" means sold out
```

## Deploy (free)

**Netlify Drop (easiest):** go to app.netlify.com/drop and drag the folder. Done.
Then go to Site settings → Change site name → `bahia-pizza.netlify.app`.
**Update later:** Deploys → drag the folder again.

**Vercel:** `npx vercel` in the folder (choose "Other", no build).

**Custom domain** (optional, paid): add it in Netlify → Domain settings.

## Client updates prices alone

The client opens `their-site/admin.html`, edits, and clicks **Exporter**. They send you the `config.js`, or drag it to Netlify themselves if you give them access.
(The admin page can't break the live site. It only produces a file.)

## Tests

```
npm i playwright jsqr pngjs
node tests/e2e.js
```
These run 85 checks on a phone-sized browser: FR/AR, cart math, fees, phone validation, WhatsApp message, admin, QR, and 3G speed.
Results go to `tests/report.md` and screenshots to `tests/screenshots/`.

## Notes

- Photos are optional, and items show an emoji tile without one. Photos uploaded in admin are resized to about 15 KB each.
- In demo mode, WhatsApp asks which contact to send to, so no real number is used.
- Customer details and the cart are saved on the customer's phone for the next order.
