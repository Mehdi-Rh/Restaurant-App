// DEMO: fictional fast-food in Oran. Prices = typical Oran 2026.
window.CONFIG = {
  "id": "bahia-pizza",
  "mode": "menu",
  "lang": "fr",
  "languages": ["fr", "ar"],
  "messageLang": "auto",
  "currency": "DA",
  "currency_ar": "دج",
  "demo": true,
  "business": {
    "name": "Bahia Pizza",
    "name_ar": "باهية بيتزا",
    "tagline": "Pizzas au feu de bois & tacos • Oran",
    "tagline_ar": "بيتزا على الحطب وطاكوس • وهران",
    "hours": "11h – 00h, 7j/7",
    "hours_ar": "11:00 – 00:00 كل يوم",
    "address": "Bd Millenium, Oran",
    "address_ar": "شارع الألفية، وهران",
    "logo": "🍕",
    "whatsapp": "213500000000",
    "instagram": ""
  },
  "colors": { "primary": "#c1121f", "accent": "#f77f00", "bg": "#fdf8f3" },
  "delivery": {
    "wilayas": ["31"],
    "freeAbove": 3000,
    "minOrder": 500,
    "options": [
      { "id": "home", "label": "Livraison", "label_ar": "توصيل", "fee": 200, "address": true },
      { "id": "pickup", "label": "À emporter", "label_ar": "استلام من المحل", "fee": 0, "address": false }
    ]
  },
  "categories": [
    { "id": "pizzas", "name": "Pizzas", "name_ar": "بيتزا", "icon": "🍕" },
    { "id": "tacos", "name": "Tacos & Sandwichs", "name_ar": "طاكوس وسندويشات", "icon": "🌯" },
    { "id": "burgers", "name": "Burgers", "name_ar": "برغر", "icon": "🍔" },
    { "id": "sides", "name": "Accompagnements", "name_ar": "مقبلات", "icon": "🍟" },
    { "id": "drinks", "name": "Boissons", "name_ar": "مشروبات", "icon": "🥤" }
  ],
  "items": [
    { "id": "margherita", "cat": "pizzas", "name": "Margherita", "name_ar": "مارغريتا", "desc": "Sauce tomate, mozzarella, olives", "desc_ar": "صلصة طماطم، موزاريلا، زيتون", "price": 600, "emoji": "🍕",
      "variants": [ { "name": "Taille", "name_ar": "الحجم", "choices": [ { "label": "M", "price": 600 }, { "label": "L", "price": 900 }, { "label": "XL", "price": 1300 } ] } ] },
    { "id": "thon", "cat": "pizzas", "name": "Thon", "name_ar": "تونة", "desc": "Thon, oignons, mozzarella", "desc_ar": "تونة، بصل، موزاريلا", "price": 750, "emoji": "🍕", "popular": true,
      "variants": [ { "name": "Taille", "name_ar": "الحجم", "choices": [ { "label": "M", "price": 750 }, { "label": "L", "price": 1100 }, { "label": "XL", "price": 1500 } ] } ] },
    { "id": "4fromages", "cat": "pizzas", "name": "4 Fromages", "name_ar": "4 أجبان", "desc": "Mozzarella, cheddar, bleu, camembert", "desc_ar": "موزاريلا، شيدر، جبن أزرق، كاممبير", "price": 900, "emoji": "🧀",
      "variants": [ { "name": "Taille", "name_ar": "الحجم", "choices": [ { "label": "M", "price": 900 }, { "label": "L", "price": 1300 }, { "label": "XL", "price": 1800 } ] } ] },
    { "id": "viande-hachee", "cat": "pizzas", "name": "Viande hachée", "name_ar": "لحم مفروم", "desc": "Viande hachée, poivrons, mozzarella", "desc_ar": "لحم مفروم، فلفل، موزاريلا", "price": 950, "emoji": "🍕",
      "variants": [ { "name": "Taille", "name_ar": "الحجم", "choices": [ { "label": "M", "price": 950 }, { "label": "L", "price": 1400 }, { "label": "XL", "price": 1900, "soldOut": true } ] } ] },
    { "id": "tacos", "cat": "tacos", "name": "Tacos", "name_ar": "طاكوس", "desc": "Frites, sauce fromagère, viande au choix", "desc_ar": "بطاطا، صلصة الجبن، لحم حسب الاختيار", "price": 450, "emoji": "🌯", "popular": true,
      "variants": [
        { "name": "Taille", "name_ar": "الحجم", "choices": [ { "label": "Simple", "label_ar": "عادي", "price": 450 }, { "label": "Double", "label_ar": "دوبل", "price": 650 }, { "label": "XL", "price": 850 } ] },
        { "name": "Viande", "name_ar": "اللحم", "choices": [ { "label": "Poulet", "label_ar": "دجاج" }, { "label": "Viande hachée", "label_ar": "لحم مفروم" }, { "label": "Cordon bleu", "label_ar": "كوردون بلو" }, { "label": "Mixte", "label_ar": "مختلط", "add": 100 } ] },
        { "name": "Suppléments", "name_ar": "إضافات", "multi": true, "choices": [ { "label": "Cheddar", "label_ar": "شيدر", "add": 80 }, { "label": "Œuf", "label_ar": "بيض", "add": 50 }, { "label": "Frites dedans", "label_ar": "بطاطا داخل", "add": 50 } ] }
      ] },
    { "id": "chawarma", "cat": "tacos", "name": "Chawarma", "name_ar": "شاورما", "desc": "Poulet mariné, sauce blanche, frites", "desc_ar": "دجاج متبل، صلصة بيضاء، بطاطا", "price": 350, "emoji": "🥙",
      "variants": [ { "name": "Pain", "name_ar": "الخبز", "choices": [ { "label": "Libanais", "label_ar": "لبناني" }, { "label": "Matlou3", "label_ar": "مطلوع", "add": 30 } ] } ] },
    { "id": "panini", "cat": "tacos", "name": "Panini poulet", "name_ar": "بانيني دجاج", "desc": "Poulet, fromage, sauce algérienne", "desc_ar": "دجاج، جبن، صلصة جزائرية", "price": 300, "emoji": "🥪" },
    { "id": "burger", "cat": "burgers", "name": "Classic burger", "name_ar": "برغر كلاسيك", "desc": "Steak haché, cheddar, salade, tomate", "desc_ar": "ستيك مفروم، شيدر، خس، طماطم", "price": 450, "emoji": "🍔",
      "variants": [ { "name": "Formule", "name_ar": "الوجبة", "choices": [ { "label": "Seul", "label_ar": "وحده", "price": 450 }, { "label": "Menu (frites + boisson)", "label_ar": "منيو (بطاطا + مشروب)", "price": 650 } ] } ] },
    { "id": "double-cheese", "cat": "burgers", "name": "Double cheese", "name_ar": "دوبل تشيز", "desc": "2 steaks, double cheddar, oignons caramélisés", "desc_ar": "2 ستيك، دوبل شيدر، بصل مكرمل", "price": 650, "emoji": "🍔", "popular": true,
      "variants": [ { "name": "Formule", "name_ar": "الوجبة", "choices": [ { "label": "Seul", "label_ar": "وحده", "price": 650 }, { "label": "Menu (frites + boisson)", "label_ar": "منيو (بطاطا + مشروب)", "price": 850 } ] } ] },
    { "id": "frites", "cat": "sides", "name": "Frites", "name_ar": "بطاطا مقلية", "price": 150, "emoji": "🍟" },
    { "id": "nuggets", "cat": "sides", "name": "Nuggets x6", "name_ar": "ناغتس ×6", "price": 350, "emoji": "🍗" },
    { "id": "salade", "cat": "sides", "name": "Salade variée", "name_ar": "سلطة متنوعة", "price": 250, "emoji": "🥗" },
    { "id": "hamoud", "cat": "drinks", "name": "Hamoud Boualem 33cl", "name_ar": "حمود بوعلام 33 سل", "price": 100, "emoji": "🥤" },
    { "id": "coca", "cat": "drinks", "name": "Coca-Cola 33cl", "name_ar": "كوكا كولا 33 سل", "price": 120, "emoji": "🥤" },
    { "id": "eau", "cat": "drinks", "name": "Eau minérale 50cl", "name_ar": "ماء معدني 50 سل", "price": 50, "emoji": "💧" },
    { "id": "jus", "cat": "drinks", "name": "Jus d'orange pressé", "name_ar": "عصير برتقال طبيعي", "price": 250, "emoji": "🍊", "soldOut": true }
  ]
};
