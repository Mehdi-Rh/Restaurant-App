# Test report

**75/75 checks passed** · 2026-11-19 14:18 UTC · Chromium, Pixel 5 emulation

## ✅ Restaurant FR: menu → options → cart → WhatsApp
- ✓ demo banner shown
- ✓ category chips (got 5, want 5)
- ✓ LTR in French (got "ltr", want "ltr")
- ✓ item sheet opens
- ✓ sheet total 2 × L = 1 800 DA
- ✓ cart bar total 1 800
- ✓ tacos Double+Mixte+Cheddar = 830
- ✓ sold-out item does not open
- ✓ cart count 4 (got "4", want "4")
- ✓ subtotal 2 780
- ✓ sold-out size XL disabled
- ✓ total with 200 DA delivery = 2 980
- ✓ single wilaya (Oran) → no wilaya select (got 0, want 0)
- ✓ empty form → 3 errors (name, phone, address) (got 3, want 3)
- ✓ no WhatsApp opened when invalid (got 0, want 0)
- ✓ bad phone rejected
- ✓ WhatsApp link opened (got 1, want 1)
- ✓ demo mode → no business number (contact chooser)
- ✓ message has: Nouvelle commande #
- ✓ message has: Bahia Pizza
- ✓ message has: 2 × Margherita (L) : 1 800 DA
- ✓ message has: 1 × Tacos (Taille: Double, Viande: Mixte, Suppléments: Cheddar) : 830 DA
- ✓ message has: 1 × Frites : 150 DA
- ✓ message has: Sous-total : 2 780 DA
- ✓ message has: Livraison : 200 DA
- ✓ message has: *Total : 2 980 DA*
- ✓ message has: Client : Karim Benali
- ✓ message has: Tél : 0555 12 34 56
- ✓ message has: Mode : Livraison
- ✓ message has: Wilaya : 31 - Oran
- ✓ message has: Adresse : Hai Khemisti, bâtiment 12

## ✅ Restaurant: back from WhatsApp, persistence, free delivery, pickup, minimum
- ✓ "order ready" screen restored after back
- ✓ cart survives reload
- ✓ customer details remembered
- ✓ free delivery above 3 000 DA
- ✓ pickup → no address field (got 0, want 0)
- ✓ pickup message has no address
- ✓ finish empties cart (got 0, want 0)
- ✓ below 500 DA minimum → send disabled
- ✓ no JS errors: 

## ✅ Restaurant AR: RTL + Arabic message
- ✓ RTL in Arabic (got "rtl", want "rtl")
- ✓ Arabic business name
- ✓ AR message has: طلب جديد
- ✓ AR message has: باهية بيتزا
- ✓ AR message has: 1 × تونة (XL) : 1 500 دج
- ✓ AR message has: 1 × طاكوس (الحجم: عادي، اللحم: دجاج)
- ✓ AR message has: الزبون : محمد
- ✓ AR message has: 0661 22 33 44
- ✓ AR message has: الولاية : 31 - وهران
- ✓ every AR line starts with RTL mark
- ✓ no JS errors: 

## ✅ Shop: sizes/colors, 58 wilayas, fees, stop desk, Arabic digits
- ✓ XL sold out
- ✓ color swatches
- ✓ abaya large size +500 = 7 000
- ✓ 58 wilayas + placeholder (got 59, want 59)
- ✓ fee unknown before wilaya
- ✓ Alger home = 500
- ✓ Tamanrasset home = 1 500
- ✓ Tamanrasset desk = 1 000 → total 12 500
- ✓ shop message has: 1 × Ensemble jogging oversize (Taille: M, Couleur: Noir) : 4 500 DA
- ✓ shop message has: Wilaya : 11 - Tamanrasset
- ✓ shop message has: Mode : Bureau (stop desk)
- ✓ shop message has: Livraison : 1 000 DA
- ✓ shop message has: Tél : 0770 12 34 56
- ✓ shop message has: *Total : 12 500 DA*
- ✓ no JS errors: 

## ✅ QR generator
- ✓ QR decodes to the link (got "https://bahia-pizza.netlify.app/", want "https://bahia-pizza.netlify.app/")
- ✓ poster QR decodes too (got "https://bahia-pizza.netlify.app/", want "https://bahia-pizza.netlify.app/")
- ✓ no JS errors: 

## ✅ Performance: page weight + slow 3G load
- ✓ bahia-pizza: total transfer 47.8 KB (< 80 KB, uncompressed)
- ✓ bahia-pizza: loads in 1.8 s on slow 3G (400 kbps, 400 ms latency)
- ✓ lina-style: total transfer 47.4 KB (< 80 KB, uncompressed)
- ✓ lina-style: loads in 1.8 s on slow 3G (400 kbps, 400 ms latency)

## ✅ Desktop layout
- ✓ no horizontal scroll on desktop
- ✓ no horizontal scroll on phone

