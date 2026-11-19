/* End-to-end tests for the multi-restaurant platform: many brands on one site, owner admin, /platform page,
   closed shops, order counter, link previews (real Netlify edge function) and the real platform edge function.
   Run:  node tests/e2e-platform.js      (needs: playwright, pngjs) */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { createMock } = require('./mock-supabase');
const { readConfig, toRows } = require('../tools/config-to-sql');
const ROOT = path.resolve(__dirname, '..'), SHOTS = path.join(__dirname, 'screenshots'), PORT = 8767, SBPORT = 54330;
const BASE = `http://localhost:${PORT}/`, SBURL = `http://localhost:${SBPORT}`;

const A = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'pizza@test.dz', password: 'secret123' };
const B = { id: 'bbbbbbbb-0000-0000-0000-000000000002', email: 'lina@test.dz', password: 'secret456' };
const M = { id: 'mmmmmmmm-0000-0000-0000-000000000009', email: 'mehdi@test.dz', password: 'platform1' };
const mock = createMock({ users: [A, B, M], admins: [M.id], shops: [
  { id: 'bahia-pizza', owner: A.id, rows: toRows(readConfig(path.join(ROOT, 'demos/bahia-pizza/config.js')), 'bahia-pizza') },
  { id: 'lina-style', owner: B.id, rows: toRows(readConfig(path.join(ROOT, 'demos/lina-style/config.js')), 'lina-style') }] });
mock.db.shops.forEach(s => { delete s.settings.demo; });
const shop = id => mock.db.shops.find(s => s.id === id);
const LINA = shop('lina-style').settings.business.name;

// ---- a local "Netlify": static files, /:slug → index.html, and the real brand edge function on HTML pages
const CONFIG_JS = `window.CONFIG={supabase:{url:"${SBURL}",key:"anon-key"},defaultShop:"bahia-pizza",baseDomain:""};`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };
let brand = null, brandCache = null;
function staticResponse(p) {
  if (p === '/config.js') return new Response(CONFIG_JS, { headers: { 'Content-Type': MIME['.js'] } });
  let f = path.join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
  if (!f.startsWith(ROOT)) return new Response('', { status: 404 });
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    if (/^\/[a-z0-9][a-z0-9-]*\/?$/.test(p)) f = path.join(ROOT, 'index.html');   // netlify.toml redirect rule
    else return new Response('', { status: 404 });
  }
  return new Response(fs.readFileSync(f), { headers: { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' } });
}
const EXCLUDED = /\.(js|css|png|jpg|webp|svg|ico)$|^\/(lib|demos|tests|supabase)\/|^\/(admin|platform|qr)/;
const site = http.createServer(async (q, r) => {
  const host = q.headers['x-test-host'] || 'localhost:' + PORT;
  const url = new URL(q.url, 'http://' + host), p = decodeURIComponent(url.pathname);
  let res;
  if (EXCLUDED.test(p)) res = staticResponse(p);
  else res = await brand(new Request(url.href), { next: async () => staticResponse(p) });
  r.writeHead(res.status, Object.fromEntries(res.headers)); r.end(Buffer.from(await res.arrayBuffer()));
});

const results = [], allErrors = []; let current = '';
const ok = (c, msg) => { results.push({ test: current, ok: !!c, msg }); if (!c) console.log('  ✗ ' + msg); };
const eq = (a, b, msg) => ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const N = s => String(s).replace(/ /g, ' ');
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png') });
const section = n => { current = n; console.log(n); };

async function phone(browser, opts = {}) {
  const ctx = await browser.newContext({ ...devices['Pixel 5'], ...opts });
  const page = await ctx.newPage(); page.errors = [];
  page.on('pageerror', e => { page.errors.push(e.message); allErrors.push(current + ': ' + e.message); });
  page.on('dialog', d => (d.type() === 'prompt' ? d.accept('newpass99') : d.accept()));
  await ctx.route('https://cdn.test/**', r => r.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(SHOTS, '01-pizza-menu-fr.png')) }));
  await ctx.route('https://wa.me/**', r => { page.wa = r.request().url(); r.fulfill({ body: 'stub' }); });
  return page;
}
async function login(page, u, url = 'admin.html') {
  await page.goto(BASE + url);
  await page.fill('#em', u.email); await page.fill('#pw', u.password); await page.click('#login .btn');
}
const COVER = 'https://cdn.test/bahia-cover.png';
const hm = d => ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);

async function run() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const bm = await import('../netlify/edge-functions/brand/index.js'); brand = bm.default; brandCache = bm._cache;
  await new Promise(r => site.listen(PORT, r)); await new Promise(r => mock.server.listen(SBPORT, r));
  const browser = await chromium.launch();

  section('Two restaurants, one site, each with its own brand');
  let p1 = await phone(browser), p2 = await phone(browser);
  await p1.goto(BASE + 'bahia-pizza'); await p2.goto(BASE + 'lina-style');
  await p1.waitForSelector('.item'); await p2.waitForSelector('.item');
  eq(N(await p1.locator('h1').innerText()), 'Bahia Pizza', '/bahia-pizza shows Bahia Pizza');
  eq(N(await p2.locator('h1').innerText()), LINA, '/lina-style shows Lina Style');
  const col = pg => pg.evaluate(() => getComputedStyle(document.querySelector('.hero')).backgroundColor);
  ok(await col(p1) !== await col(p2), 'each shop uses its own colors');
  ok(await p1.evaluate(() => document.body.classList.contains('mode-menu')) && await p2.evaluate(() => document.body.classList.contains('mode-shop')), 'restaurant list vs shop grid layout');
  eq(await p1.locator('.item').count(), mock.db.items.filter(i => i.shop_id === 'bahia-pizza' && !i.hidden).length, 'Bahia shows only its own items');
  eq(await p2.locator('.item').count(), mock.db.items.filter(i => i.shop_id === 'lina-style' && !i.hidden).length, 'Lina shows only its own items');
  await shot(p1, '31-brand-bahia'); await shot(p2, '32-brand-lina');

  section('Links: bare address, unknown link, trailing slash');
  await p1.goto(BASE); await p1.waitForURL(/\/bahia-pizza$/); await p1.waitForSelector('.item');
  ok(true, 'bare address redirects to the default shop (old QR codes keep working)');
  await p1.goto(BASE + 'lina-style/'); await p1.waitForSelector('.item');
  eq(N(await p1.locator('h1').innerText()), LINA, 'trailing slash works');
  await p1.goto(BASE + 'nope-shop'); await p1.waitForSelector('text=Menu introuvable');
  ok(true, 'unknown link shows "Menu introuvable"');
  await shot(p1, '33-not-found');
  const r1 = await p1.evaluate(() => {
    const f = window.__shopRouting.slugFromLocation;
    return [f({ pathname: '/admin', search: '', hostname: 'x.netlify.app' }), f({ pathname: '/', search: '?shop=lina-style', hostname: 'x' }), f({ pathname: '/', search: '', hostname: 'x' })];
  });
  eq(JSON.stringify(r1), '[null,"lina-style",null]', 'reserved words are never shop links; ?shop= works');

  section('Cache is separate per shop (path links share one browser storage)');
  const keys = await p1.evaluate(() => Object.keys(localStorage).filter(k => /_data$/.test(k)).sort());
  eq(JSON.stringify(keys), '["wo_bahia_pizza_data","wo_lina_style_data"]', 'one cache per shop');
  await p1.context().route(SBURL + '/**', r => r.abort());
  await p1.goto(BASE + 'lina-style'); await p1.waitForSelector('.item');
  eq(N(await p1.locator('h1').innerText()), LINA, 'offline: Lina still shows Lina from cache, not Bahia');
  await p1.context().unroute(SBURL + '/**');
  await p1.context().close(); await p2.context().close();

  section('Themes, cover photo, social links');
  const themes = ['classic', 'dark', 'street', 'elegant'], bgs = [];
  const pt = await phone(browser);
  for (const t of themes) {
    shop('bahia-pizza').settings.theme = t;
    await pt.goto(BASE + 'bahia-pizza'); await pt.waitForFunction(th => document.body.classList.contains('theme-' + th), t);
    bgs.push(await pt.evaluate(() => getComputedStyle(document.body).backgroundColor));
    await shot(pt, '34-theme-' + t);
  }
  eq(new Set(bgs).size, 4, 'the 4 themes look different');
  shop('bahia-pizza').settings.theme = 'classic';
  Object.assign(shop('bahia-pizza').settings.business, { cover: COVER, tiktok: 'bahiapizza', facebook: 'bahiapizzaoran', maps: 'https://maps.app.goo.gl/abc', instagram: 'bahia.pizza' });
  await pt.goto(BASE + 'bahia-pizza'); await pt.waitForSelector('.hero.cover');
  ok(true, 'cover photo shown in the header');
  eq(await pt.locator('footer .social a').count(), 4, 'Instagram, TikTok, Facebook, Maps links in footer');
  ok((await pt.locator('footer .social a', { hasText: 'TikTok' }).getAttribute('href')) === 'https://www.tiktok.com/@bahiapizza', 'TikTok link is correct');

  section('Opening hours: auto "Fermé"');
  const os = await pt.evaluate(() => {
    const f = window.__openState, d = (h, m, day) => { const x = new Date(2026, 10, 15 + day, h, m); return x; };  // 2026-11-15 is a Sunday
    return [
      f({ open: '11:00', close: '23:00' }, d(12, 0, 1)).open, f({ open: '11:00', close: '23:00' }, d(23, 30, 1)).open,
      f({ open: '18:00', close: '02:00' }, d(1, 0, 2)).open, f({ open: '18:00', close: '02:00' }, d(3, 0, 2)).open,
      f({ open: '11:00', close: '23:00', closedDays: [5] }, d(12, 0, 5)).open, f({ open: '18:00', close: '02:00', closedDays: [5] }, d(1, 0, 6)).open,
      f({}, d(3, 0, 1)).open];
  });
  eq(JSON.stringify(os), '[true,false,true,false,false,false,true]', 'day hours, overnight hours, closed days, no hours = open');
  const n = new Date(), later = new Date(n.getTime() + 2 * 3600e3), later2 = new Date(n.getTime() + 4 * 3600e3);
  Object.assign(shop('bahia-pizza').settings.business, { open: hm(later), close: hm(later2) });
  await pt.goto(BASE + 'bahia-pizza'); await pt.waitForSelector('.hours.shut');
  ok((await pt.locator('.hours').innerText()).includes('Ouvre à ' + hm(later)), 'header says closed and when it opens');
  await pt.locator('.item:not(.out)').first().click();
  if (await pt.locator('[data-act=addline]').count()) await pt.click('[data-act=addline]');
  await pt.click('.cartbar');
  ok(await pt.locator('[data-act=send]').isDisabled(), 'order button blocked while closed');
  await shot(pt, '35-closed-hours');
  Object.assign(shop('bahia-pizza').settings.business, { open: hm(new Date(n.getTime() - 3600e3)), close: hm(later) });
  await pt.goto(BASE + 'bahia-pizza'); await pt.waitForSelector('.hours:not(.shut)');
  ok((await pt.locator('.hours').innerText()).includes('Ouvert jusqu’à'), 'open now shows closing time');

  section('Order counter');
  await pt.click('.cartbar');
  await pt.click('[data-act=opt][data-o=pickup]'); await pt.fill('#f-name', 'Test'); await pt.fill('#f-phone', '0555123456');
  await pt.click('[data-act=send]'); await pt.waitForTimeout(400);
  eq(mock.db.order_events.filter(o => o.shop_id === 'bahia-pizza').length, 1, 'one tap on "Envoyer" = one order counted');
  ok(mock.db.order_events[0].total > 0, 'order value counted (no customer data stored)');
  await pt.context().close();

  section('Link previews (real Netlify edge function)');
  brandCache.clear();   // the browser visits above already filled it
  let html = await (await fetch(BASE + 'lina-style')).text();
  ok(html.includes('<title>' + LINA + '</title>'), 'page title is the shop name before any script runs');
  ok(html.includes('property="og:title" content="' + LINA + '"'), 'WhatsApp/Facebook preview title');
  ok(/name="theme-color" content="#[0-9a-f]{6}"/i.test(html) && (html.match(/theme-color/g) || []).length === 1, 'shop color as phone bar color (one tag)');
  ok(html.includes('rel="manifest" href="/manifest.webmanifest?shop=lina-style"'), 'per-shop app manifest linked');
  html = await (await fetch(BASE + 'bahia-pizza')).text();
  ok(html.includes('property="og:image" content="' + COVER + '"'), 'cover photo is the preview image');
  const man = await (await fetch(BASE + 'manifest.webmanifest?shop=bahia-pizza')).json();
  eq(man.start_url + ' ' + man.name, '/bahia-pizza Bahia Pizza', 'home-screen app opens the right shop with its name');
  html = await (await fetch(BASE + 'nope-shop')).text();
  ok(html.includes('<title>Commander en ligne</title>'), 'unknown shop: page left unchanged');
  shop('lina-style').settings.business.name = 'Renamed';
  html = await (await fetch(BASE + 'lina-style')).text();
  ok(html.includes('<title>' + LINA + '</title>'), 'branding cached 5 minutes (no Supabase call per visit)');
  shop('lina-style').settings.business.name = LINA;

  section('Custom domain');
  mock.db.domains.push({ host: 'menu.lina.dz', shop_id: 'lina-style' });
  const pd = await phone(browser);
  await pd.context().route('http://menu.lina.dz/**', async r => {
    const u = new URL(r.request().url());
    const res = await fetch(BASE.slice(0, -1) + u.pathname + u.search, { headers: { 'x-test-host': 'menu.lina.dz' } });
    r.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  await pd.context().route(SBURL + '/**', async r => {   // Chrome blocks public → localhost calls; a real domain calls a real Supabase
    const q = r.request(), res = await fetch(q.url(), { method: q.method(), headers: q.headers(), body: q.postDataBuffer() || undefined });
    r.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  await pd.goto('http://menu.lina.dz/'); await pd.waitForSelector('.item', { timeout: 8000 });
  eq(N(await pd.locator('h1').innerText()), LINA, 'menu.lina.dz opens Lina Style');
  eq(await pd.title(), LINA, 'custom domain gets the shop preview too');
  await pd.context().close();

  section('Owner admin finds its shop from the login');
  let adm = await phone(browser);
  await login(adm, A); await adm.waitForSelector('.top h1');
  eq(N(await adm.locator('.top h1').innerText()), 'Bahia Pizza', 'Bahia owner lands on Bahia (no shop in config)');
  await adm.waitForSelector('.stats');
  eq(await adm.locator('.stats b').first().innerText(), '1', 'admin shows today\'s orders');
  ok(await adm.locator('[data-a=switch]').count() === 0, 'owners get no shop switcher');
  await adm.click('[data-a=tab][data-t=shop]');
  await adm.click('[data-a=theme][data-v=street]');
  await adm.fill('[data-p="business.open"]', '11:00'); await adm.fill('[data-p="business.close"]', '23:30');
  await adm.click('[data-a=day][data-v="5"]');
  await adm.fill('[data-p="business.tiktok"]', 'bahia.tiktok');
  await shot(adm, '36-admin-brand');
  await adm.click('[data-a=save-shop]'); await adm.waitForSelector('text=Boutique enregistrée');
  const st = shop('bahia-pizza').settings;
  eq(JSON.stringify([st.theme, st.business.open, st.business.close, st.business.closedDays, st.business.tiktok]), '["street","11:00","23:30",[5],"bahia.tiktok"]', 'theme, hours, closed day, TikTok saved');
  await adm.context().close();
  adm = await phone(browser);
  await login(adm, B); await adm.waitForSelector('.top h1');
  eq(N(await adm.locator('.top h1').innerText()), LINA, 'Lina owner lands on Lina');
  await adm.goto(BASE + 'admin.html?shop=bahia-pizza'); await adm.waitForSelector('text=n\'a pas accès');
  ok(true, 'Lina owner cannot open Bahia admin with ?shop=');
  let tk = await adm.evaluate(() => JSON.parse(localStorage.getItem('wo_admin')).access_token);
  let r = await fetch(SBURL + '/functions/v1/platform', { method: 'POST', headers: { apikey: 'anon-key', Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_shop', id: 'evil', name: 'x', email: 'e@x.dz', password: '12345678' }) });
  eq(r.status, 403, 'owners cannot call the platform edge function');
  r = await fetch(SBURL + '/rest/v1/rpc/platform_shops', { method: 'POST', headers: { apikey: 'anon-key', Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: '{}' });
  ok(r.status >= 400, 'owners cannot list all shops');
  await adm.goto(BASE + 'platform.html'); await adm.waitForSelector('text=Accès réservé');
  ok(true, 'platform page refuses owners');
  await adm.context().close();

  section('Platform page: create a restaurant');
  let pl = await phone(browser);
  await login(pl, M, 'platform.html'); await pl.waitForSelector('.kpis');
  eq(await pl.locator('[data-shop]').count(), 2, 'lists all restaurants');
  eq(await pl.locator('.kpis b').first().innerText(), '2', 'restaurant count');
  await shot(pl, '37-platform');
  await pl.click('#new summary');
  await pl.fill('#nf [name=name]', 'Pizza Oran Centre');
  eq(await pl.inputValue('#nf [name=id]'), 'pizza-oran-centre', 'link made from the name');
  await pl.selectOption('#nf [name=copy_from]', 'bahia-pizza');
  await pl.fill('#nf [name=email]', 'oran@test.dz');
  const pw = await pl.inputValue('#nf [name=password]');
  ok(pw.length >= 8, 'starting password generated');
  await pl.click('#nf .btn'); await pl.waitForSelector('#created');
  const msg = await pl.locator('#msg').innerText();
  ok(msg.includes(BASE + 'pizza-oran-centre') && msg.includes('oran@test.dz') && msg.includes(pw), 'ready-to-send WhatsApp message with link, email, password');
  await shot(pl, '38-platform-created');
  const ns = shop('pizza-oran-centre');
  ok(ns && mock.users.find(u => u.id === ns.owner).email === 'oran@test.dz', 'shop created with a new owner login');
  eq(mock.db.items.filter(i => i.shop_id === 'pizza-oran-centre').length, mock.db.items.filter(i => i.shop_id === 'bahia-pizza').length, 'menu copied from Bahia');
  eq(await pl.locator('[data-shop]').count(), 3, 'list now shows 3 restaurants');
  await pl.click('#new summary'); await pl.fill('#nf [name=name]', 'Admin'); await pl.fill('#nf [name=email]', 'z@test.dz');
  await pl.click('#nf .btn'); await pl.waitForSelector('#nerr:not(:empty)');
  ok((await pl.locator('#nerr').innerText()).includes('Lien invalide'), 'reserved link refused');
  await pl.fill('#nf [name=id]', 'lina-style'); await pl.click('#nf .btn'); await pl.waitForFunction(() => /déjà pris/.test(document.querySelector('#nerr').textContent));
  ok(shop('lina-style').owner === B.id, 'taken link refused, Lina keeps its owner');

  const po = await phone(browser);
  await login(po, { email: 'oran@test.dz', password: pw }); await po.waitForSelector('.top h1');
  eq(N(await po.locator('.top h1').innerText()), 'Pizza Oran Centre', 'new owner logs in with the starting password');
  await po.goto(BASE + 'pizza-oran-centre'); await po.waitForSelector('.item');
  ok(await po.locator('.item').count() > 10, 'new restaurant link works right away');
  await po.context().close();

  section('Platform page: suspend, paid until, password');
  await pl.locator('[data-shop=lina-style] [data-a=status]').click();
  await pl.waitForSelector('[data-shop=lina-style] .badge.off');
  eq(shop('lina-style').status, 'suspended', 'Lina suspended');
  const pp = await phone(browser);
  await pp.goto(BASE + 'lina-style'); await pp.waitForSelector('text=Temporairement indisponible');
  eq(await pp.locator('.item').count(), 0, 'suspended shop: public sees no menu');
  await shot(pp, '39-suspended');
  await pl.locator('[data-shop=lina-style] [data-a=status]').click(); await pl.waitForSelector('[data-shop=lina-style] .badge.on');
  await pp.goto(BASE + 'lina-style'); await pp.waitForSelector('.item');
  ok(true, 'reactivated: menu back (cache refreshed)');
  await pl.locator('[data-shop=lina-style] [data-a=paid]').fill('2020-01-01');
  await pl.locator('[data-shop=lina-style] [data-a=paid]').dispatchEvent('change');
  await pl.waitForSelector('[data-shop=lina-style] .badge.off');
  eq(shop('lina-style').paid_until, '2020-01-01', 'paid-until date saved');
  await pp.goto(BASE + 'lina-style'); await pp.waitForSelector('text=Temporairement indisponible');
  ok(true, 'past paid-until date closes the shop automatically');
  await pl.locator('[data-shop=lina-style] [data-a=paid]').fill(''); await pl.locator('[data-shop=lina-style] [data-a=paid]').dispatchEvent('change');
  await pl.waitForSelector('[data-shop=lina-style] .badge.on');
  await pp.context().close();
  await pl.locator('[data-shop=pizza-oran-centre] [data-a=pass]').click(); await pl.waitForSelector('text=Mot de passe changé');
  eq(mock.users.find(u => u.email === 'oran@test.dz').password, 'newpass99', 'new password set for the owner');

  section('Platform admin edits any restaurant');
  await pl.goto(BASE + 'admin.html'); await pl.waitForSelector('[data-a=pick-shop]');
  eq(await pl.locator('[data-a=pick-shop]').count(), 3, 'admin shows a shop picker');
  await shot(pl, '40-admin-picker');
  await pl.click('[data-a=pick-shop][data-id=lina-style]'); await pl.waitForSelector('.row');
  eq(N(await pl.locator('.top h1').innerText()), LINA, 'opened Lina');
  const first = await pl.locator('[data-a=avail]').first();
  const itId = await first.getAttribute('data-id'), before = mock.db.items.find(i => i.id === itId).available;
  await first.click({ force: true }); await pl.waitForTimeout(300);
  eq(mock.db.items.find(i => i.id === itId).available, !before, 'admin toggled a Lina item');
  await pl.click('[data-a=switch]'); await pl.waitForSelector('[data-a=pick-shop]');
  ok(true, 'switch back to the picker');
  await pl.context().close();

  section('No script errors');
  eq(allErrors.join(' | '), '', 'no uncaught script errors on any page');

  await browser.close(); site.close(); mock.server.close();
  const tests = [...new Set(results.map(r => r.test))], pass = results.filter(r => r.ok).length;
  let md = `# Test report — multi-restaurant platform\n\n**${pass}/${results.length} checks passed** · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Chromium, Pixel 5 · mock Supabase + real edge functions\n\n`;
  tests.forEach(t => { const rs = results.filter(r => r.test === t); md += `## ${rs.every(r => r.ok) ? '✅' : '❌'} ${t}\n` + rs.map(r => `- ${r.ok ? '✓' : '✗'} ${r.msg}`).join('\n') + '\n\n'; });
  fs.writeFileSync(path.join(__dirname, 'report-platform.md'), md);
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
}
run().catch(e => { console.error(e); process.exit(1); });
