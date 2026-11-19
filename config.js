// ✏️ PLATFORM CONFIG — one file for all restaurants.
// url + key: Supabase → Project Settings → API keys (the publishable key is safe to publish).
// Each restaurant is opened by its link: yoursite.netlify.app/bahia-pizza
window.CONFIG = {
  supabase: {
    url: "https://uotehbsqtjmpgrheusvk.supabase.co",
    key: "sb_publishable_OT7Xx7i9qD1gNVGeJRHSNQ_cz-3pkFD"
  },
  defaultShop: "bahia-pizza",   // the bare address opens this shop, so old QR codes keep working
  baseDomain: ""                // later, with your own domain: "yoursite.com" → bahia-pizza.yoursite.com
};
