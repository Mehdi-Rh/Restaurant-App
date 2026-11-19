// DEMO: fictional Instagram clothing shop, ships to 58 wilayas.
window.CONFIG = {
  "id": "lina-style",
  "mode": "shop",
  "lang": "fr",
  "languages": ["fr", "ar"],
  "messageLang": "auto",
  "currency": "DA",
  "currency_ar": "دج",
  "demo": true,
  "business": {
    "name": "Lina Style DZ",
    "name_ar": "لينا ستايل",
    "tagline": "Mode femme & homme • Livraison 58 wilayas",
    "tagline_ar": "أزياء نسائية ورجالية • توصيل 58 ولاية",
    "hours": "Paiement à la livraison",
    "hours_ar": "الدفع عند الاستلام",
    "address": "",
    "logo": "👗",
    "whatsapp": "213500000000",
    "instagram": "linastyle.dz"
  },
  "colors": { "primary": "#7b2cbf", "accent": "#e85d9a", "bg": "#faf7fc" },
  "delivery": {
    "wilayas": [],
    "freeAbove": 12000,
    "minOrder": 0,
    "options": [
      { "id": "home", "label": "À domicile", "label_ar": "إلى المنزل", "address": true,
        "fee": { "default": 800, "16": 500, "09": 500, "35": 500, "42": 500, "31": 600, "25": 600,
                 "01": 1300, "11": 1500, "33": 1500, "37": 1500, "49": 1300, "50": 1600, "53": 1500, "54": 1600, "56": 1600 } },
      { "id": "desk", "label": "Bureau (stop desk)", "label_ar": "مكتب التوصيل", "address": true,
        "fee": { "default": 450, "16": 350, "09": 350, "35": 350, "42": 350,
                 "01": 900, "11": 1000, "33": 1000, "37": 1000, "49": 900, "50": 1100, "53": 1000, "54": 1100, "56": 1100 } }
    ]
  },
  "categories": [
    { "id": "femme", "name": "Femme", "name_ar": "نساء", "icon": "👚" },
    { "id": "homme", "name": "Homme", "name_ar": "رجال", "icon": "👕" },
    { "id": "chaussures", "name": "Chaussures", "name_ar": "أحذية", "icon": "👟" },
    { "id": "accessoires", "name": "Accessoires", "name_ar": "إكسسوارات", "icon": "👜" }
  ],
  "items": [
    { "id": "ensemble-jogging", "cat": "femme", "name": "Ensemble jogging oversize", "name_ar": "طقم رياضي أوفرسايز", "desc": "Coton molletonné, sweat + pantalon", "desc_ar": "قطن مبطن، سويت + سروال", "price": 4500, "emoji": "🧥", "popular": true,
      "variants": [
        { "name": "Taille", "name_ar": "المقاس", "choices": [ { "label": "S" }, { "label": "M" }, { "label": "L" }, { "label": "XL", "soldOut": true } ] },
        { "name": "Couleur", "name_ar": "اللون", "choices": [ { "label": "Beige", "label_ar": "بيج", "color": "#d8c3a5" }, { "label": "Noir", "label_ar": "أسود", "color": "#111111" }, { "label": "Rose poudré", "label_ar": "وردي", "color": "#e8b4bc" } ] }
      ] },
    { "id": "robe-satin", "cat": "femme", "name": "Robe longue satinée", "name_ar": "فستان طويل ساتان", "desc": "Idéale fêtes et mariages", "desc_ar": "مثالي للأعراس والمناسبات", "price": 5500, "emoji": "👗",
      "variants": [
        { "name": "Taille", "name_ar": "المقاس", "choices": [ { "label": "36" }, { "label": "38" }, { "label": "40" }, { "label": "42" } ] },
        { "name": "Couleur", "name_ar": "اللون", "choices": [ { "label": "Vert émeraude", "label_ar": "أخضر زمردي", "color": "#046307" }, { "label": "Bordeaux", "label_ar": "عنابي", "color": "#6d071a" }, { "label": "Champagne", "label_ar": "شامبانيا", "color": "#f1ddbf" } ] }
      ] },
    { "id": "abaya", "cat": "femme", "name": "Abaya crêpe", "name_ar": "عباية كريب", "desc": "Tissu fluide, coupe ample", "desc_ar": "قماش خفيف، قصة واسعة", "price": 6500, "emoji": "🧕",
      "variants": [
        { "name": "Taille", "name_ar": "المقاس", "choices": [ { "label": "Taille unique", "label_ar": "مقاس موحد" }, { "label": "Grande taille", "label_ar": "مقاس كبير", "add": 500 } ] },
        { "name": "Couleur", "name_ar": "اللون", "choices": [ { "label": "Noir", "label_ar": "أسود", "color": "#111111" }, { "label": "Taupe", "label_ar": "رمادي بني", "color": "#8b7d6b" } ] }
      ] },
    { "id": "jean-mom", "cat": "femme", "name": "Jean mom taille haute", "name_ar": "جينز مام خصر عالي", "price": 3800, "emoji": "👖",
      "variants": [ { "name": "Taille", "name_ar": "المقاس", "choices": [ { "label": "36" }, { "label": "38" }, { "label": "40" }, { "label": "42" }, { "label": "44" } ] } ] },
    { "id": "hoodie", "cat": "homme", "name": "Hoodie basique", "name_ar": "هودي أساسي", "desc": "Coton 320 g, coupe regular", "desc_ar": "قطن 320 غ، قصة عادية", "price": 3500, "emoji": "🧥", "popular": true,
      "variants": [
        { "name": "Taille", "name_ar": "المقاس", "choices": [ { "label": "M" }, { "label": "L" }, { "label": "XL" }, { "label": "XXL" } ] },
        { "name": "Couleur", "name_ar": "اللون", "choices": [ { "label": "Noir", "label_ar": "أسود", "color": "#111111" }, { "label": "Gris", "label_ar": "رمادي", "color": "#9ca3af" }, { "label": "Bleu marine", "label_ar": "كحلي", "color": "#1e3a5f" } ] }
      ] },
    { "id": "tshirt", "cat": "homme", "name": "T-shirt oversize", "name_ar": "تيشيرت أوفرسايز", "price": 1800, "emoji": "👕",
      "variants": [
        { "name": "Taille", "name_ar": "المقاس", "choices": [ { "label": "M" }, { "label": "L" }, { "label": "XL" } ] },
        { "name": "Couleur", "name_ar": "اللون", "choices": [ { "label": "Blanc", "label_ar": "أبيض", "color": "#ffffff" }, { "label": "Noir", "label_ar": "أسود", "color": "#111111" } ] }
      ] },
    { "id": "cargo", "cat": "homme", "name": "Pantalon cargo", "name_ar": "سروال كارغو", "price": 4200, "emoji": "👖",
      "variants": [ { "name": "Taille", "name_ar": "المقاس", "choices": [ { "label": "38" }, { "label": "40" }, { "label": "42" }, { "label": "44" } ] } ] },
    { "id": "baskets", "cat": "chaussures", "name": "Baskets blanches", "name_ar": "أحذية رياضية بيضاء", "price": 6900, "emoji": "👟",
      "variants": [ { "name": "Pointure", "name_ar": "المقاس", "choices": [ { "label": "37" }, { "label": "38" }, { "label": "39" }, { "label": "40" }, { "label": "41" }, { "label": "42" }, { "label": "43", "soldOut": true } ] } ] },
    { "id": "sac", "cat": "accessoires", "name": "Sac bandoulière", "name_ar": "حقيبة كتف", "price": 2900, "emoji": "👜",
      "variants": [ { "name": "Couleur", "name_ar": "اللون", "choices": [ { "label": "Camel", "label_ar": "جملي", "color": "#c19a6b" }, { "label": "Noir", "label_ar": "أسود", "color": "#111111" } ] } ] },
    { "id": "foulard", "cat": "accessoires", "name": "Foulard en soie", "name_ar": "وشاح حرير", "price": 1500, "emoji": "🧣", "soldOut": true }
  ]
};
