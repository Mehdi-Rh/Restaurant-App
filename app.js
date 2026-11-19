/* WhatsApp Order Template — app.js (no dependencies) */
(function () {
  'use strict';

  var C = window.CONFIG || {};
  try {
    if (/[?&]preview=1/.test(location.search)) {
      var pv = localStorage.getItem('wo_preview');
      if (pv) C = JSON.parse(pv);
    }
  } catch (e) {}

  var W = window.WILAYAS || [];
  var B, D, ITEMS, CATS, OPTS, allowedW;
  function applyConfig(c) {
    C = c; B = C.business || {}; D = C.delivery || {};
    ITEMS = C.items || []; CATS = C.categories || [];
    OPTS = D.options && D.options.length ? D.options : [{ id: 'home', label: 'Livraison', label_ar: 'توصيل', fee: 0, address: true }];
    allowedW = (D.wilayas && D.wilayas.length) ? W.filter(function (w) { return D.wilayas.indexOf(w[0]) >= 0; }) : W;
  }
  applyConfig(C);

  /* ---------- storage ---------- */
  var NS = 'wo_' + String(C.shop || C.id || B.name || 'shop').replace(/\W+/g, '_') + '_';
  function sget(k, d) { try { var v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function sset(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} }

  var langs = C.languages || ['fr', 'ar'];
  var lang = sget('lang', C.lang || langs[0] || 'fr');
  if (langs.indexOf(lang) < 0) lang = langs[0];
  var cart = sget('cart', []);
  var cust = sget('customer', {});
  var view = null;      // null | {type:'item', id} | {type:'cart'} | {type:'done', url}
  var pick = null;      // current variant selection while picking
  var pickQty = 1;
  var errors = {};
  var lastView = null;  // sheet type shown last render (animate only on open)

  /* ---------- i18n ---------- */
  var T = {
    fr: {
      add: 'Ajouter', from: 'dès', viewCart: 'Voir le panier', cart: 'Votre commande', empty: 'Votre panier est vide.',
      subtotal: 'Sous-total', delivery: 'Livraison', total: 'Total', free: 'Gratuite', toChoose: 'selon wilaya',
      name: 'Nom complet', phone: 'Téléphone', wilaya: 'Wilaya', choose: 'Choisir…', address: 'Adresse (commune, quartier, rue)',
      note: 'Remarque (optionnel)', send: 'Envoyer la commande sur WhatsApp', back: 'Retour', required: 'Champ obligatoire',
      badPhone: 'Numéro invalide (ex : 0555 12 34 56)', soldOut: 'Épuisé', mode: 'Mode', done: 'Commande prête !',
      doneTxt: 'WhatsApp s’ouvre avec votre commande. Appuyez sur « Envoyer » dans WhatsApp pour la confirmer.',
      reopen: 'Rouvrir WhatsApp', finish: 'Terminer et vider le panier', freeAbove: 'Livraison gratuite dès',
      minOrder: 'Commande minimum', demo: 'Démo : choisissez un contact dans WhatsApp, rien n’est envoyé au commerce.',
      required1: 'obligatoire', popular: 'Populaire', newOrder: 'Nouvelle commande', customer: 'Client', addr: 'Adresse',
      offline: 'Connexion impossible. Vérifiez votre internet.', retry: 'Réessayer', noteL: 'Note', tel: 'Tél', items: 'article(s)', addTo: 'Ajouter au panier', fee: 'Frais'
    },
    ar: {
      add: 'أضف', from: 'من', viewCart: 'عرض السلة', cart: 'طلبك', empty: 'سلتك فارغة.',
      subtotal: 'المجموع الفرعي', delivery: 'التوصيل', total: 'المجموع', free: 'مجاني', toChoose: 'حسب الولاية',
      name: 'الاسم الكامل', phone: 'رقم الهاتف', wilaya: 'الولاية', choose: 'اختر…', address: 'العنوان (البلدية، الحي، الشارع)',
      note: 'ملاحظة (اختياري)', send: 'أرسل الطلب عبر واتساب', back: 'رجوع', required: 'خانة إجبارية',
      badPhone: 'رقم غير صحيح (مثال: 0555123456)', soldOut: 'نفد', mode: 'طريقة الاستلام', done: 'طلبك جاهز!',
      doneTxt: 'سيفتح واتساب مع طلبك. اضغط «إرسال» في واتساب لتأكيده.',
      reopen: 'افتح واتساب مجددًا', finish: 'إنهاء وإفراغ السلة', freeAbove: 'توصيل مجاني ابتداءً من',
      minOrder: 'الحد الأدنى للطلب', demo: 'نسخة تجريبية: اختر أي جهة اتصال، لا يُرسل شيء للمحل.',
      required1: 'إجباري', popular: 'الأكثر طلبًا', newOrder: 'طلب جديد', customer: 'الزبون', addr: 'العنوان',
      offline: 'تعذر الاتصال. تحقق من الإنترنت.', retry: 'إعادة المحاولة', noteL: 'ملاحظة', tel: 'الهاتف', items: 'منتج', addTo: 'أضف إلى السلة', fee: 'المصاريف'
    }
  };
  function t(k, l) { var d = T[l || lang] || T.fr; return d[k] || T.fr[k] || k; }
  function L(o, f, l) { if (!o) return ''; l = l || lang; return (l === 'ar' && o[f + '_ar']) || o[f] || ''; }
  function money(n, l) {
    // NBSP as thousands separator: keeps "1 500" in one piece inside Arabic (RTL) text
    var s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    return s + ' ' + (((l || lang) === 'ar' && C.currency_ar) || C.currency || 'DA');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- pricing ---------- */
  function byId(id) { for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i]; return null; }
  function priceOf(it, sel) {
    var p = +it.price || 0;
    (it.variants || []).forEach(function (v, vi) {
      var s = sel ? sel[vi] : null;
      var idx = v.multi ? (s || []) : (s == null ? [] : [s]);
      idx.forEach(function (ci) {
        var c = v.choices[ci]; if (!c) return;
        if (c.price != null && c.price !== '') p = +c.price;
      });
    });
    (it.variants || []).forEach(function (v, vi) {
      var s = sel ? sel[vi] : null;
      var idx = v.multi ? (s || []) : (s == null ? [] : [s]);
      idx.forEach(function (ci) { var c = v.choices[ci]; if (c && c.add) p += +c.add; });
    });
    return p;
  }
  function minPrice(it) {
    var p = +it.price || 0, hasAbs = false;
    (it.variants || []).forEach(function (v) {
      if (v.multi) return;
      var ps = v.choices.filter(function (c) { return c.price != null && c.price !== ''; }).map(function (c) { return +c.price; });
      if (ps.length) { p = Math.min.apply(null, ps); hasAbs = true; }
    });
    return { p: p, varies: hasAbs };
  }
  function defaultSel(it) {
    return (it.variants || []).map(function (v) {
      if (v.multi) return [];
      for (var i = 0; i < v.choices.length; i++) if (!v.choices[i].soldOut) return i;
      return null;
    });
  }
  function selText(it, sel, l) {
    var parts = [];
    (it.variants || []).forEach(function (v, vi) {
      var s = sel[vi];
      var idx = v.multi ? (s || []) : (s == null ? [] : [s]);
      var labels = idx.map(function (ci) { return L(v.choices[ci], 'label', l); }).filter(Boolean);
      if (labels.length) parts.push((it.variants.length > 1 || v.multi ? L(v, 'name', l) + ': ' : '') + labels.join(' + '));
    });
    return parts.join((l || lang) === 'ar' ? '، ' : ', ');
  }
  function lineKey(id, sel) { return id + '|' + JSON.stringify(sel); }
  function subtotal() { return cart.reduce(function (s, l) { var it = byId(l.id); return it ? s + priceOf(it, l.sel) * l.qty : s; }, 0); }
  function count() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function cleanCart() { cart = cart.filter(function (l) { return byId(l.id) && l.qty > 0; }); }

  /* ---------- delivery ---------- */
  function curOpt() { for (var i = 0; i < OPTS.length; i++) if (OPTS[i].id === cust.opt) return OPTS[i]; return OPTS[0]; }
  function curWilaya() {
    if (allowedW.length === 1) return allowedW[0][0];
    return cust.wilaya || '';
  }
  function feeFor(opt, w) {
    var f = opt.fee;
    if (f == null) return 0;
    if (typeof f === 'number') return f;
    if (!w) return null;
    return f[w] != null ? +f[w] : (f['default'] != null ? +f['default'] : 0);
  }
  function deliveryFee() {
    var opt = curOpt();
    var fee = feeFor(opt, curWilaya());
    if (fee && D.freeAbove && subtotal() >= D.freeAbove) return 0;
    return fee;
  }
  function wName(code, l) { for (var i = 0; i < W.length; i++) if (W[i][0] === code) return code + ' - ' + ((l || lang) === 'ar' ? W[i][2] : W[i][1]); return code; }

  /* ---------- rendering ---------- */
  var root = document.getElementById('app');
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function thumb(it, big) {
    if (it.img) return '<img class="ph" loading="lazy" decoding="async" alt="" src="' + esc(big ? it.img : (it.thumb || it.img)) + '"' +
      (it.thumb && !big ? ' onerror="this.onerror=null;this.src=\'' + esc(it.img) + '\'"' : '') + '>';
    return '<div class="ph emo" style="--h:' + hue(it.id || it.name || '') + '">' + esc(it.emoji || (catOf(it) || {}).icon || '🛍️') + '</div>';
  }
  function catOf(it) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === it.cat) return CATS[i]; return null; }
  function logo() {
    var lg = B.logo || '🛒';
    if (/[./]/.test(lg)) return '<img class="logo" alt="" src="' + esc(lg) + '">';
    return '<div class="logo emo">' + esc(lg) + '</div>';
  }

  function render() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = L(B, 'name') || 'Commander';
    var col = C.colors || {};
    var st = document.documentElement.style;
    if (col.primary) st.setProperty('--primary', col.primary);
    if (col.accent) st.setProperty('--accent', col.accent);
    if (col.bg) st.setProperty('--bg', col.bg);
    document.body.className = 'mode-' + (C.mode || 'menu') + (view ? ' noscroll' : '');

    var h = '';
    if (!live && !ITEMS.length && !(C.supabase && C.supabase.url)) {
      root.innerHTML = '<div class="state"><p>⚙️ Configurez <code>config.js</code> (supabase.url, supabase.key, shop).</p></div>';
      return;
    }
    if (loading || loadError) {
      root.innerHTML = '<div class="state">' + (loading ? '<div class="spin"></div>' :
        '<p>📶 ' + esc(t('offline')) + '</p><button class="cta" data-act="retry">' + esc(t('retry')) + '</button>') + '</div>';
      return;
    }
    if (C.demo) h += '<div class="demo">' + esc(t('demo')) + '</div>';
    h += '<header class="hero"><div class="wrap hrow">' + logo() +
      '<div class="hinfo"><h1>' + esc(L(B, 'name')) + '</h1>' +
      (L(B, 'tagline') ? '<p>' + esc(L(B, 'tagline')) + '</p>' : '') +
      '<p class="meta">' + [L(B, 'hours'), L(B, 'address')].filter(Boolean).map(esc).join(' · ') + '</p></div>' +
      (langs.length > 1 ? '<button class="lang" data-act="lang">' + (lang === 'ar' ? 'FR' : 'عربي') + '</button>' : '') +
      '</div>';
    var badges = [];
    if (D.freeAbove) badges.push('🚚 ' + t('freeAbove') + ' ' + money(D.freeAbove));
    if (D.minOrder) badges.push(t('minOrder') + ' : ' + money(D.minOrder));
    if (badges.length) h += '<div class="wrap badges">' + badges.map(function (b) { return '<span>' + esc(b) + '</span>'; }).join('') + '</div>';
    h += '</header>';

    var cats = CATS.filter(function (c) { return ITEMS.some(function (i) { return i.cat === c.id && !i.hidden; }); });
    var loose = ITEMS.filter(function (i) { return !i.hidden && !catOf(i); });
    if (cats.length > 1) {
      h += '<nav class="cats"><div class="wrap">' + cats.map(function (c) {
        return '<a href="#c-' + esc(c.id) + '">' + esc((c.icon ? c.icon + ' ' : '') + L(c, 'name')) + '</a>';
      }).join('') + '</div></nav>';
    }
    h += '<main class="wrap">';
    cats.forEach(function (c) {
      h += '<section id="c-' + esc(c.id) + '"><h2>' + esc(L(c, 'name')) + '</h2><div class="list">' +
        ITEMS.filter(function (i) { return i.cat === c.id && !i.hidden; }).map(card).join('') + '</div></section>';
    });
    if (loose.length) h += '<section><div class="list">' + loose.map(card).join('') + '</div></section>';
    h += '<footer>' + esc(L(B, 'name')) + (B.instagram ? ' · <a href="https://instagram.com/' + esc(B.instagram) + '" target="_blank" rel="noopener">@' + esc(B.instagram) + '</a>' : '') + '</footer>';
    h += '</main>';

    var n = count();
    if (n && !view) h += '<button class="cartbar" data-act="cart"><span class="cnt">' + n + '</span><span>' + esc(t('viewCart')) + '</span><b>' + money(subtotal()) + '</b></button>';
    var anim = view && (!lastView || lastView !== view.type);
    lastView = view ? view.type : null;
    if (view) h += '<div class="overlay' + (anim ? ' anim' : '') + '" data-act="close"></div><div class="sheet' + (anim ? ' anim' : '') + '" role="dialog">' + sheet() + '</div>';

    // keep scroll + focus
    var y = window.scrollY, sheetEl = root.querySelector('.sheet'), sy = sheetEl ? sheetEl.scrollTop : 0;
    var fid = document.activeElement && document.activeElement.id;
    root.innerHTML = h;
    window.scrollTo(0, y);
    var ns = root.querySelector('.sheet'); if (ns) ns.scrollTop = sy;
    if (fid) { var fe = document.getElementById(fid); if (fe) { fe.focus(); } }
  }

  function card(it) {
    var mp = minPrice(it), inCart = cart.filter(function (l) { return l.id === it.id; }).reduce(function (s, l) { return s + l.qty; }, 0);
    return '<article class="item' + (it.soldOut ? ' out' : '') + '" data-act="open" data-id="' + esc(it.id) + '">' + thumb(it) +
      '<div class="ibody"><h3>' + esc(L(it, 'name')) + (it.popular ? ' <em class="pop">' + esc(t('popular')) + '</em>' : '') + '</h3>' +
      (L(it, 'desc') ? '<p>' + esc(L(it, 'desc')) + '</p>' : '') +
      '<div class="irow"><span class="price">' + (mp.varies ? '<small>' + esc(t('from')) + '</small> ' : '') + money(mp.p) + '</span>' +
      (it.soldOut ? '<span class="tag">' + esc(t('soldOut')) + '</span>' :
        '<span class="addbtn" aria-label="' + esc(t('add')) + '">' + (inCart ? '<i>' + inCart + '</i>' : '+') + '</span>') +
      '</div></div></article>';
  }

  function sheet() {
    if (view.type === 'item') return itemSheet();
    if (view.type === 'done') return doneSheet();
    return cartSheet();
  }

  function itemSheet() {
    var it = byId(view.id);
    var h = '<div class="shead"><button class="x" data-act="close" aria-label="close">✕</button></div>';
    h += '<div class="ihero">' + thumb(it, true) + '</div><div class="spad"><h2>' + esc(L(it, 'name')) + '</h2>' +
      (L(it, 'desc') ? '<p class="muted">' + esc(L(it, 'desc')) + '</p>' : '');
    (it.variants || []).forEach(function (v, vi) {
      h += '<div class="vgroup"><div class="vname">' + esc(L(v, 'name')) + (v.multi ? '' : ' <small>' + esc(t('required1')) + '</small>') + '</div><div class="chips">';
      v.choices.forEach(function (c, ci) {
        var on = v.multi ? (pick[vi] || []).indexOf(ci) >= 0 : pick[vi] === ci;
        var extra = c.price != null && c.price !== '' ? money(c.price) : (c.add ? '+' + money(c.add) : '');
        h += '<button class="chip' + (on ? ' on' : '') + (c.soldOut ? ' dis' : '') + '"' + (c.soldOut ? ' disabled' : '') +
          ' data-act="choose" data-v="' + vi + '" data-c="' + ci + '">' +
          (c.color ? '<span class="sw" style="background:' + esc(c.color) + '"></span>' : '') +
          esc(L(c, 'label')) + (extra ? ' <small>' + esc(extra) + '</small>' : '') + '</button>';
      });
      h += '</div></div>';
    });
    var ok = (it.variants || []).every(function (v, vi) { return v.multi || pick[vi] != null; });
    h += '</div><div class="sfoot"><div class="qty"><button data-act="qm">−</button><b>' + pickQty + '</b><button data-act="qp">+</button></div>' +
      '<button class="cta" data-act="addline"' + (ok ? '' : ' disabled') + '>' + esc(t('addTo')) + ' · ' + money(priceOf(it, pick) * pickQty) + '</button></div>';
    return h;
  }

  function field(id, label, html) {
    return '<label class="fld' + (errors[id] ? ' err' : '') + '" for="f-' + id + '"><span>' + esc(label) + '</span>' + html +
      (errors[id] ? '<em>' + esc(errors[id]) + '</em>' : '') + '</label>';
  }

  function cartSheet() {
    cleanCart();
    var h = '<div class="shead"><h2>' + esc(t('cart')) + '</h2><button class="x" data-act="close" aria-label="close">✕</button></div><div class="spad">';
    if (!cart.length) return h + '<p class="muted center">' + esc(t('empty')) + '</p></div>';
    h += '<ul class="lines">' + cart.map(function (l, i) {
      var it = byId(l.id), s = selText(it, l.sel);
      return '<li><div class="lt"><b>' + esc(L(it, 'name')) + '</b>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</div>' +
        '<div class="qty sm"><button data-act="lm" data-i="' + i + '">−</button><b>' + l.qty + '</b><button data-act="lp" data-i="' + i + '">+</button></div>' +
        '<span class="lp">' + money(priceOf(it, l.sel) * l.qty) + '</span></li>';
    }).join('') + '</ul>';

    var opt = curOpt();
    if (OPTS.length > 1) {
      h += '<div class="opts">' + OPTS.map(function (o) {
        var f = feeFor(o, curWilaya());
        return '<button class="opt' + (o.id === opt.id ? ' on' : '') + '" data-act="opt" data-o="' + esc(o.id) + '"><b>' + esc(L(o, 'label')) + '</b><small>' +
          (f === 0 ? esc(t('free')) : f == null ? esc(t('toChoose')) : money(f)) + '</small></button>';
      }).join('') + '</div>';
    }
    h += field('name', t('name'), '<input id="f-name" data-k="name" autocomplete="name" value="' + esc(cust.name || '') + '">');
    h += field('phone', t('phone'), '<input id="f-phone" data-k="phone" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="0555 12 34 56" value="' + esc(cust.phone || '') + '">');
    if (opt.address !== false) {
      if (allowedW.length > 1) {
        h += field('wilaya', t('wilaya'), '<select id="f-wilaya" data-k="wilaya"><option value="">' + esc(t('choose')) + '</option>' +
          allowedW.map(function (w) { return '<option value="' + w[0] + '"' + (cust.wilaya === w[0] ? ' selected' : '') + '>' + esc(wName(w[0])) + '</option>'; }).join('') + '</select>');
      }
      h += field('address', t('address'), '<textarea id="f-address" data-k="address" rows="2" autocomplete="street-address">' + esc(cust.address || '') + '</textarea>');
    }
    h += field('note', t('note'), '<textarea id="f-note" data-k="note" rows="2">' + esc(cust.note || '') + '</textarea>');

    var fee = deliveryFee(), sub = subtotal();
    h += '<div class="tot"><div><span>' + esc(t('subtotal')) + '</span><span>' + money(sub) + '</span></div>';
    if (opt.fee != null && opt.fee !== 0) h += '<div><span>' + esc(L(opt, 'label')) + '</span><span>' + (fee == null ? '—' : fee === 0 ? esc(t('free')) : money(fee)) + '</span></div>';
    h += '<div class="big"><span>' + esc(t('total')) + '</span><span>' + money(sub + (fee || 0)) + '</span></div></div>';
    var below = D.minOrder && sub < D.minOrder;
    if (below) h += '<p class="warn">' + esc(t('minOrder')) + ' : ' + money(D.minOrder) + '</p>';
    h += '</div><div class="sfoot"><button class="cta wa" data-act="send"' + (below ? ' disabled' : '') + '>' + waIcon + esc(t('send')) + '</button></div>';
    return h;
  }

  function doneSheet() {
    return '<div class="shead"><span></span><button class="x" data-act="close" aria-label="close">✕</button></div>' +
      '<div class="spad center"><div class="big-ok">✅</div><h2>' + esc(t('done')) + '</h2><p class="muted">' + esc(t('doneTxt')) + '</p>' +
      '<p><a class="cta wa" href="' + esc(view.url) + '">' + waIcon + esc(t('reopen')) + '</a></p>' +
      '<p><button class="ghost" data-act="finish">' + esc(t('finish')) + '</button></p></div>';
  }

  var waIcon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';

  /* ---------- order message ---------- */
  function normPhone(p) {
    p = String(p || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d+]/g, '');
    if (p.indexOf('+213') === 0) p = '0' + p.slice(4);
    else if (p.indexOf('00213') === 0) p = '0' + p.slice(5);
    else if (p.indexOf('213') === 0 && p.length === 12) p = '0' + p.slice(3);
    return p;
  }
  function prettyPhone(p) { return p.length === 10 ? p.replace(/(\d{4})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4') : p; }
  function orderId() { var d = new Date(); return (d.getDate() < 10 ? '0' : '') + d.getDate() + '' + Math.random().toString(36).slice(2, 5).toUpperCase(); }

  function buildMessage() {
    var ml = C.messageLang && C.messageLang !== 'auto' ? C.messageLang : lang;
    var rtl = ml === 'ar', M = rtl ? '‏' : '';
    var opt = curOpt(), fee = deliveryFee(), sub = subtotal();
    var out = [];
    out.push('🛒 *' + t('newOrder', ml) + ' #' + orderId() + '*');
    out.push(L(B, 'name', ml));
    out.push('');
    cart.forEach(function (l) {
      var it = byId(l.id), s = selText(it, l.sel, ml);
      out.push('▪️ ' + l.qty + ' × ' + L(it, 'name', ml) + (s ? ' (' + s + ')' : '') + ' : ' + money(priceOf(it, l.sel) * l.qty, ml));
    });
    out.push('');
    out.push(t('subtotal', ml) + ' : ' + money(sub, ml));
    if (opt.fee != null && opt.fee !== 0) out.push(t('delivery', ml) + ' : ' + (fee === 0 ? t('free', ml) : money(fee || 0, ml)));
    out.push('*' + t('total', ml) + ' : ' + money(sub + (fee || 0), ml) + '*');
    out.push('');
    out.push('👤 ' + t('customer', ml) + ' : ' + cust.name.trim());
    out.push('📞 ' + t('tel', ml) + ' : ' + prettyPhone(normPhone(cust.phone)));
    if (OPTS.length > 1) out.push('🚚 ' + t('mode', ml) + ' : ' + L(opt, 'label', ml));
    if (opt.address !== false) {
      var w = curWilaya();
      if (w) out.push('📍 ' + t('wilaya', ml) + ' : ' + wName(w, ml));
      out.push('🏠 ' + t('addr', ml) + ' : ' + (cust.address || '').trim().replace(/\s*\n\s*/g, ', '));
    }
    if ((cust.note || '').trim()) out.push('📝 ' + t('noteL', ml) + ' : ' + cust.note.trim());
    return out.map(function (s) { return s ? M + s : s; }).join('\n');
  }

  function validate() {
    errors = {};
    var opt = curOpt();
    if (!(cust.name || '').trim()) errors.name = t('required');
    var p = normPhone(cust.phone);
    if (!p) errors.phone = t('required');
    else if (!/^0[5-7]\d{8}$/.test(p) && !/^0[2-4]\d{7}$/.test(p)) errors.phone = t('badPhone');
    if (opt.address !== false) {
      if (allowedW.length > 1 && !cust.wilaya) errors.wilaya = t('required');
      if (!(cust.address || '').trim()) errors.address = t('required');
    }
    return !Object.keys(errors).length;
  }

  function send() {
    if (!validate()) {
      render();
      var first = root.querySelector('.fld.err input, .fld.err select, .fld.err textarea');
      if (first) first.focus();
      return;
    }
    var num = String(B.whatsapp || '').replace(/\D/g, '');
    if (C.demo) num = '';
    var url = 'https://wa.me/' + num + '?text=' + encodeURIComponent(buildMessage());
    sset('customer', { name: cust.name, phone: cust.phone, wilaya: cust.wilaya, address: cust.address, opt: cust.opt });
    view = { type: 'done', url: url };
    sset('sent', { url: url, at: Date.now() });
    render();
    window.location.href = url;
  }

  /* ---------- events ---------- */
  function save() { sset('cart', cart); }
  function openItem(id) {
    var it = byId(id); if (!it || it.soldOut) return;
    if (!(it.variants || []).length) { addLine(it.id, [], 1); toast(); return; }
    pick = defaultSel(it); pickQty = 1; view = { type: 'item', id: id }; render();
  }
  function addLine(id, sel, q) {
    var k = lineKey(id, sel);
    for (var i = 0; i < cart.length; i++) if (lineKey(cart[i].id, cart[i].sel) === k) { cart[i].qty += q; save(); render(); return; }
    cart.push({ id: id, sel: sel, qty: q }); save(); render();
  }
  function toast() {
    var b = root.querySelector('.cartbar'); if (!b) return;
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act');
    if (a === 'open') openItem(el.getAttribute('data-id'));
    else if (a === 'close') { if (view && view.type === 'done') sset('sent', null); view = null; errors = {}; render(); }
    else if (a === 'lang') { lang = lang === 'ar' ? 'fr' : 'ar'; sset('lang', lang); render(); }
    else if (a === 'cart') { view = { type: 'cart' }; render(); }
    else if (a === 'choose') {
      var vi = +el.getAttribute('data-v'), ci = +el.getAttribute('data-c'), v = byId(view.id).variants[vi];
      if (v.multi) { var arr = pick[vi] || []; var at = arr.indexOf(ci); if (at >= 0) arr.splice(at, 1); else arr.push(ci); arr.sort(); pick[vi] = arr; }
      else pick[vi] = ci;
      render();
    }
    else if (a === 'qm') { if (pickQty > 1) pickQty--; render(); }
    else if (a === 'qp') { pickQty++; render(); }
    else if (a === 'addline') { var id = view.id; view = null; addLine(id, pick, pickQty); toast(); }
    else if (a === 'lm' || a === 'lp') {
      var i = +el.getAttribute('data-i'); cart[i].qty += a === 'lp' ? 1 : -1;
      if (cart[i].qty <= 0) cart.splice(i, 1);
      save(); render();
    }
    else if (a === 'opt') { cust.opt = el.getAttribute('data-o'); render(); }
    else if (a === 'send') send();
    else if (a === 'retry') { loading = true; loadError = false; render(); fetchData(); }
    else if (a === 'finish') { cart = []; save(); sset('sent', null); view = null; render(); }
  });
  root.addEventListener('input', function (e) {
    var k = e.target.getAttribute('data-k'); if (!k) return;
    cust[k] = e.target.value;
    if (errors[k]) { delete errors[k]; e.target.closest('.fld').classList.remove('err'); var em = e.target.parentNode.querySelector('em'); if (em) em.remove(); }
    if (k === 'wilaya') render(); // fee depends on wilaya
  });
  root.addEventListener('change', function (e) { if (e.target.getAttribute('data-k') === 'wilaya') { cust.wilaya = e.target.value; render(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && view) { view = null; render(); } });

  // back from WhatsApp web: show the "order ready" screen again
  /* ---------- live data from Supabase (cache first, then refresh) ---------- */
  function fromDb(row, base) {
    var st = row.settings || {};
    var c = {};
    Object.keys(st).forEach(function (k) { c[k] = st[k]; });
    c.shop = base.shop; c.supabase = base.supabase;
    c.categories = (row.categories || []).sort(function (a, b) { return a.position - b.position; })
      .map(function (k) { return { id: k.id, name: k.name, name_ar: k.name_ar, icon: k.icon }; });
    c.items = (row.items || []).filter(function (i) { return !i.hidden; })
      .sort(function (a, b) { return a.position - b.position || (a.name > b.name ? 1 : -1); })
      .map(function (i) {
        return { id: i.id, cat: i.category_id, name: i.name, name_ar: i.name_ar, desc: i.description, desc_ar: i.description_ar,
          price: i.price, img: i.photo || null, thumb: i.photo ? i.photo.replace(/(\.\w+)$/, '_t$1') : null,
          emoji: i.emoji, variants: i.variants || [], soldOut: !i.available, popular: i.popular };
      });
    return c;
  }
  var live = C.supabase && C.supabase.url && C.shop;
  var loading = false, loadError = false;
  if (live) {
    var base = { shop: C.shop, supabase: C.supabase };
    var cached = sget('data', null);
    if (cached) applyConfig(cached); else loading = true;
    var url = C.supabase.url.replace(/\/$/, '') + '/rest/v1/shops?id=eq.' + encodeURIComponent(C.shop) +
      '&select=settings,categories(id,name,name_ar,icon,position),items(id,category_id,name,name_ar,description,description_ar,price,photo,emoji,variants,available,popular,hidden,position)';
    var fetchData = function () {
      fetch(url, { headers: { apikey: C.supabase.key, Authorization: 'Bearer ' + C.supabase.key } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (rows) {
          if (!rows.length) throw new Error('shop not found');
          var fresh = fromDb(rows[0], base);
          loading = false; loadError = false;
          if (JSON.stringify(fresh) !== JSON.stringify(sget('data', null))) { sset('data', fresh); applyConfig(fresh); cleanCart(); save(); render(); }
          else if (!cached) render();
        })
        .catch(function () { loading = false; loadError = !sget('data', null); render(); });
    };
    fetchData();
    window.addEventListener('online', function () { if (loadError) fetchData(); });
  }

  var sent = sget('sent', null);
  if (sent && cart.length && Date.now() - sent.at < 30 * 60 * 1000) view = { type: 'done', url: sent.url };

  render();
})();
