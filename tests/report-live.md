# Test report — Supabase version

**50/50 checks passed** · 2026-11-19 15:42 UTC · Chromium, Pixel 5 · mock Supabase

## ✅ Public page reads the menu from Supabase
- ✓ 16 items loaded from the database (got 16, want 16)
- ✓ shop name from settings (got "Bahia Pizza", want "Bahia Pizza")
- ✓ unavailable item shown as sold out
- ✓ order goes to the shop WhatsApp number from the database
- ✓ order message uses database prices

## ✅ Offline / weak network
- ✓ menu still shows from phone cache when Supabase is unreachable (got 16, want 16)
- ✓ first visit without network shows retry screen
- ✓ retry loads the menu once network is back

## ✅ Admin login & access control
- ✓ wrong password rejected (got "Email ou mot de passe incorrect", want "Email ou mot de passe incorrect")
- ✓ other client cannot open this shop admin
- ✓ admin lists all 16 items (got 16, want 16)
- ✓ grouped by 5 categories (got 5, want 5)
- ✓ session kept after reload (no new login)

## ✅ Admin: quick availability toggle
- ✓ switch off → item unavailable in database (got false, want false)
- ✓ switch does not open the editor (got 0, want 0)
- ✓ search filters (no item named pizza) (got 0, want 0)
- ✓ search finds Thon (got 1, want 1)

## ✅ Admin: add item with photo (compressed) and options
- ✓ item saved
- ✓ empty base price → lowest size price (got 800, want 800)
- ✓ category saved (got "75abe4c5-fb3b-4a9e-88d6-b3f704fcaaa8", want "75abe4c5-fb3b-4a9e-88d6-b3f704fcaaa8")
- ✓ sizes, sold-out XL and extra saved (got "[[\"size\",false,[[\"M\",800,null,false],[\"L\",1200,null,false],[\"XL\",1700,null,true]]],[\"extra\",true,[[\"Fromage\",null,100,false]]]]", want "[[\"size\",false,[[\"M\",800,null,false],[\"L\",1200,null,false],[\"XL\",1700,null,true]]],[\"extra\",true,[[\"Fromage\",null,100,false]]]]")
- ✓ photo stored as WebP
- ✓ photo 11.3 MB → 71 KB (≤ 100 KB)
- ✓ thumbnail 3 KB (≤ 20 KB)
- ✓ photo saved in the shop folder

## ✅ Public page shows admin changes
- ✓ new item visible with "from 800 DA"
- ✓ list uses the small thumbnail
- ✓ Frites shows as sold out
- ✓ detail uses the full photo
- ✓ sold-out size disabled for customers
- ✓ no JS errors on public page: 

## ✅ Admin: edit, remove photo, delete
- ✓ price edited (got 850, want 850)
- ✓ photo removed from item (got null, want null)
- ✓ old photo files deleted from storage
- ✓ item deleted
- ✓ saving an untouched item keeps all its options (got "[[{\"label\":\"Simple\",\"label_ar\":\"عادي\",\"price\":450},{\"label\":\"Double\",\"label_ar\":\"دوبل\",\"price\":650},{\"label\":\"XL\",\"price\":850}],[{\"label\":\"Poulet\",\"label_ar\":\"دجاج\"},{\"label\":\"Viande hachée\",\"label_ar\":\"لحم مفروم\"},{\"label\":\"Cordon bleu\",\"label_ar\":\"كوردون بلو\"},{\"label\":\"Mixte\",\"label_ar\":\"مختلط\",\"add\":100}],[{\"label\":\"Cheddar\",\"label_ar\":\"شيدر\",\"add\":80},{\"label\":\"Œuf\",\"label_ar\":\"بيض\",\"add\":50},{\"label\":\"Frites dedans\",\"label_ar\":\"بطاطا داخل\",\"add\":50}]]", want "[[{\"label\":\"Simple\",\"label_ar\":\"عادي\",\"price\":450},{\"label\":\"Double\",\"label_ar\":\"دوبل\",\"price\":650},{\"label\":\"XL\",\"price\":850}],[{\"label\":\"Poulet\",\"label_ar\":\"دجاج\"},{\"label\":\"Viande hachée\",\"label_ar\":\"لحم مفروم\"},{\"label\":\"Cordon bleu\",\"label_ar\":\"كوردون بلو\"},{\"label\":\"Mixte\",\"label_ar\":\"مختلط\",\"add\":100}],[{\"label\":\"Cheddar\",\"label_ar\":\"شيدر\",\"add\":80},{\"label\":\"Œuf\",\"label_ar\":\"بيض\",\"add\":50},{\"label\":\"Frites dedans\",\"label_ar\":\"بطاطا داخل\",\"add\":50}]]")

## ✅ Admin: categories
- ✓ category added
- ✓ category moved up (got "Desserts", want "Desserts")
- ✓ category deleted
- ✓ its items kept, without category (got null, want null)

## ✅ Admin: shop settings
- ✓ invalid WhatsApp number refused
- ✓ WhatsApp saved in international format (got "213661223344", want "213661223344")
- ✓ name saved (got "Bahia Pizza Oran", want "Bahia Pizza Oran")
- ✓ per-wilaya fee saved (got "{\"31\":150,\"default\":200}", want "{\"31\":150,\"default\":200}")
- ✓ admin has no horizontal scroll on a phone
- ✓ no JS errors in admin: 

## ✅ Security (mock mirrors schema.sql)
- ✓ cannot add items to another shop (got 403, want 403)
- ✓ cannot change shop owner (got 403, want 403)
- ✓ cannot upload into another shop folder (got 403, want 403)

## ✅ Public page after settings change
- ✓ new name live (got "Bahia Pizza Oran", want "Bahia Pizza Oran")

