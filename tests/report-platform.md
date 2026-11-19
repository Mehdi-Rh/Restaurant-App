# Test report — multi-restaurant platform

**64/64 checks passed** · 2026-11-19 16:44 UTC · Chromium, Pixel 5 · mock Supabase + real edge functions

## ✅ Two restaurants, one site, each with its own brand
- ✓ /bahia-pizza shows Bahia Pizza (got "Bahia Pizza", want "Bahia Pizza")
- ✓ /lina-style shows Lina Style (got "Lina Style DZ", want "Lina Style DZ")
- ✓ each shop uses its own colors
- ✓ restaurant list vs shop grid layout
- ✓ Bahia shows only its own items (got 16, want 16)
- ✓ Lina shows only its own items (got 10, want 10)

## ✅ Links: bare address, unknown link, trailing slash
- ✓ bare address redirects to the default shop (old QR codes keep working)
- ✓ trailing slash works (got "Lina Style DZ", want "Lina Style DZ")
- ✓ unknown link shows "Menu introuvable"
- ✓ reserved words are never shop links; ?shop= works (got "[null,\"lina-style\",null]", want "[null,\"lina-style\",null]")

## ✅ Cache is separate per shop (path links share one browser storage)
- ✓ one cache per shop (got "[\"wo_bahia_pizza_data\",\"wo_lina_style_data\"]", want "[\"wo_bahia_pizza_data\",\"wo_lina_style_data\"]")
- ✓ offline: Lina still shows Lina from cache, not Bahia (got "Lina Style DZ", want "Lina Style DZ")

## ✅ Themes, cover photo, social links
- ✓ the 4 themes look different (got 4, want 4)
- ✓ cover photo shown in the header
- ✓ Instagram, TikTok, Facebook, Maps links in footer (got 4, want 4)
- ✓ TikTok link is correct

## ✅ Opening hours: auto "Fermé"
- ✓ day hours, overnight hours, closed days, no hours = open (got "[true,false,true,false,false,false,true]", want "[true,false,true,false,false,false,true]")
- ✓ header says closed and when it opens
- ✓ order button blocked while closed
- ✓ open now shows closing time

## ✅ Order counter
- ✓ one tap on "Envoyer" = one order counted (got 1, want 1)
- ✓ order value counted (no customer data stored)

## ✅ Link previews (real Netlify edge function)
- ✓ page title is the shop name before any script runs
- ✓ WhatsApp/Facebook preview title
- ✓ shop color as phone bar color (one tag)
- ✓ per-shop app manifest linked
- ✓ cover photo is the preview image
- ✓ home-screen app opens the right shop with its name (got "/bahia-pizza Bahia Pizza", want "/bahia-pizza Bahia Pizza")
- ✓ unknown shop: page left unchanged
- ✓ branding cached 5 minutes (no Supabase call per visit)

## ✅ Custom domain
- ✓ menu.lina.dz opens Lina Style (got "Lina Style DZ", want "Lina Style DZ")
- ✓ custom domain gets the shop preview too (got "Lina Style DZ", want "Lina Style DZ")

## ✅ Owner admin finds its shop from the login
- ✓ Bahia owner lands on Bahia (no shop in config) (got "Bahia Pizza", want "Bahia Pizza")
- ✓ admin shows today's orders (got "1", want "1")
- ✓ owners get no shop switcher
- ✓ theme, hours, closed day, TikTok saved (got "[\"street\",\"11:00\",\"23:30\",[5],\"bahia.tiktok\"]", want "[\"street\",\"11:00\",\"23:30\",[5],\"bahia.tiktok\"]")
- ✓ Lina owner lands on Lina (got "Lina Style DZ", want "Lina Style DZ")
- ✓ Lina owner cannot open Bahia admin with ?shop=
- ✓ owners cannot call the platform edge function (got 403, want 403)
- ✓ owners cannot list all shops
- ✓ platform page refuses owners

## ✅ Platform page: create a restaurant
- ✓ lists all restaurants (got 2, want 2)
- ✓ restaurant count (got "2", want "2")
- ✓ link made from the name (got "pizza-oran-centre", want "pizza-oran-centre")
- ✓ starting password generated
- ✓ ready-to-send WhatsApp message with link, email, password
- ✓ shop created with a new owner login
- ✓ menu copied from Bahia (got 16, want 16)
- ✓ list now shows 3 restaurants (got 3, want 3)
- ✓ reserved link refused
- ✓ taken link refused, Lina keeps its owner
- ✓ new owner logs in with the starting password (got "Pizza Oran Centre", want "Pizza Oran Centre")
- ✓ new restaurant link works right away

## ✅ Platform page: suspend, paid until, password
- ✓ Lina suspended (got "suspended", want "suspended")
- ✓ suspended shop: public sees no menu (got 0, want 0)
- ✓ reactivated: menu back (cache refreshed)
- ✓ paid-until date saved (got "2020-01-01", want "2020-01-01")
- ✓ past paid-until date closes the shop automatically
- ✓ new password set for the owner (got "newpass99", want "newpass99")

## ✅ Platform admin edits any restaurant
- ✓ admin shows a shop picker (got 3, want 3)
- ✓ opened Lina (got "Lina Style DZ", want "Lina Style DZ")
- ✓ admin toggled a Lina item (got false, want false)
- ✓ switch back to the picker

## ✅ No script errors
- ✓ no uncaught script errors on any page (got "", want "")

