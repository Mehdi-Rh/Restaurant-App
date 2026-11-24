/* End-to-end tests for the Supabase version (public page + admin), against tests/mock-supabase.js.
   Run:  node tests/e2e-live.js      (needs: playwright, pngjs) */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const { createMock } = require('./mock-supabase');
const { readConfig, toRows } = require('../tools/config-to-sql');
const ROOT = path.resolve(__dirname, '..'), SHOTS = path.join(__dirname, 'screenshots'), PORT = 8766, SBPORT = 54329;
const BASE = `http://localhost:${PORT}/`, SBURL = `http://localhost:${SBPORT}`;

const A = { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'pizza@test.dz', password: 'secret123' };
const B = { id: 'bbbbbbbb-0000-0000-0000-000000000002', email: 'lina@test.dz', password: 'secret456' };
const mock = createMock({ users: [A, B], shops: [
  { id: 'bahia-pizza', owner: A.id, rows: toRows(readConfig(path.join(ROOT, 'demos/bahia-pizza/config.js')), 'bahia-pizza') },
  { id: 'lina-style', owner: B.id, rows: toRows(readConfig(path.join(ROOT, 'demos/lina-style/config.js')), 'lina-style') }] });
mock.db.shops.forEach(s => { delete s.settings.demo; });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };
const site = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (p === '/config.js') { r.writeHead(200, { 'Content-Type': MIME['.js'] }); return r.end(`window.CONFIG={supabase:{url:"${SBURL}",key:"anon-key"},shop:"bahia-pizza"};`); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

const results = []; let current = '';
const ok = (c, msg) => { results.push({ test: current, ok: !!c, msg }); if (!c) console.log('  ✗ ' + msg); };
const eq = (a, b, msg) => ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const N = s => String(s).replace(/ /g, ' ');
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png') });
const item = name => mock.db.items.find(i => i.shop_id === 'bahia-pizza' && i.name === name);

async function phone(browser) {
  const ctx = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await ctx.newPage(); page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('dialog', d => d.accept());
  await ctx.route('https://wa.me/**', r => { page.wa = r.request().url(); r.fulfill({ body: 'stub' }); });
  return page;
}
async function login(page, u) {
  await page.goto(BASE + 'admin.html');
  await page.fill('#em', u.email); await page.fill('#pw', u.password); await page.click('#login .btn');
}
function bigPhoto() {   // 2400×1800 noisy photo-like PNG (several MB) to prove compression works
  const png = new PNG({ width: 2400, height: 1800 });
  for (let y = 0; y < 1800; y++) for (let x = 0; x < 2400; x++) {
    const i = (y * 2400 + x) * 4, n = Math.random() * 60;
    png.data[i] = 180 + n * Math.sin(x / 40) | 0; png.data[i + 1] = 90 + y / 30 + n | 0; png.data[i + 2] = 40 + n | 0; png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

async function run() {
  fs.mkdirSync(SHOTS, { recursive: true });
  await new Promise(r => site.listen(PORT, r)); await new Promise(r => mock.server.listen(SBPORT, r));
  const browser = await chromium.launch();

  current = 'Public page reads the menu from Supabase';
  console.log(current);
  let pub = await phone(browser);
  await pub.goto(BASE);
  await pub.waitForSelector('.item');
  eq(await pub.locator('.item').count(), 16, '16 items loaded from the database');
  eq(N(await pub.locator('h1').innerText()), 'Bahia Pizza', 'shop name from settings');
  ok(await pub.locator('.item.out').count() === 1, 'unavailable item shown as sold out');
  await pub.locator('.item').filter({ has: pub.locator('h3', { hasText: 'Margherita' }) }).click();
  await pub.locator('.sheet .chip', { hasText: 'L' }).first().click(); await pub.click('[data-act=addline]');
  await pub.click('.cartbar'); await pub.click('[data-act=opt][data-o=pickup]');
  await pub.fill('#f-name', 'Test'); await pub.fill('#f-phone', '0555123456'); await pub.click('[data-act=send]'); await pub.waitForTimeout(200);
  ok(pub.wa && pub.wa.startsWith('https://wa.me/213500000000?text='), 'order goes to the shop WhatsApp number from the database');
  ok(N(decodeURIComponent(pub.wa.split('text=')[1])).includes('1 × Margherita (L) : 900 DA'), 'order message uses database prices');

  current = 'Offline / weak network';
  console.log(current);
  await pub.context().route(SBURL + '/**', r => r.abort());
  await pub.goto(BASE); await pub.waitForSelector('.item');
  eq(await pub.locator('.item').count(), 16, 'menu still shows from phone cache when Supabase is unreachable');
  await pub.context().close();
  pub = await phone(browser);
  await pub.context().route(SBURL + '/**', r => r.abort());
  await pub.goto(BASE); await pub.waitForSelector('[data-act=retry]');
  ok(true, 'first visit without network shows retry screen');
  await shot(pub, '21-live-offline');
  await pub.context().unroute(SBURL + '/**');
  await pub.click('[data-act=retry]'); await pub.waitForSelector('.item');
  ok(true, 'retry loads the menu once network is back');
  await pub.context().close();

  current = 'Admin login & access control';
  console.log(current);
  let adm = await phone(browser);
  await login(adm, { email: A.email, password: 'wrong' });
  await adm.waitForSelector('#lerr:not(:empty)');
  eq(await adm.locator('#lerr').innerText(), 'Email ou mot de passe incorrect', 'wrong password rejected');
  await shot(adm, '22-admin-login');
  await login(adm, B);
  await adm.waitForSelector('text=n\'a pas accès');
  ok(true, 'other client cannot open this shop admin');
  await adm.context().close();
  adm = await phone(browser);
  await login(adm, A);
  await adm.waitForSelector('.row');
  eq(await adm.locator('.row').count(), 16, 'admin lists all 16 items');
  eq(await adm.locator('.group').count(), 5, 'grouped by 5 categories');
  await shot(adm, '23-admin-items');
  await adm.reload(); await adm.waitForSelector('.row');
  ok(true, 'session kept after reload (no new login)');

  current = 'Admin: quick availability toggle';
  console.log(current);
  await adm.locator('.row', { hasText: 'Frites' }).first().locator('input[data-a=avail]').click();
  await adm.waitForTimeout(300);
  eq(item('Frites').available, false, 'switch off → item unavailable in database');
  eq(await adm.locator('.sheet').count(), 0, 'switch does not open the editor');
  await adm.fill('#q', 'pizza'); eq(await adm.locator('.row').count(), 0, 'search filters (no item named pizza)');
  await adm.fill('#q', 'thon'); eq(await adm.locator('.row').count(), 1, 'search finds Thon'); await adm.fill('#q', '');

  current = 'Admin: add item with photo (compressed) and options';
  console.log(current);
  const photo = bigPhoto();
  await adm.click('.fab');
  await adm.setInputFiles('#ph', { name: 'pizza.png', mimeType: 'image/png', buffer: photo });
  await adm.waitForSelector('.photo img');
  await adm.fill('[data-k=name]', 'Pizza Merguez');
  await adm.click('.chip:has-text("Pizzas")');
  await adm.click('.qa button:has-text("Tailles")');
  const sizes = adm.locator('[data-ck=p]');
  await sizes.nth(0).fill('800'); await sizes.nth(1).fill('1200'); await sizes.nth(2).fill('1700');
  await adm.click('[data-a=so-choice][data-g="0"][data-c="2"]');
  await adm.click('.qa button:has-text("Suppléments")');
  await adm.locator('[data-g="1"][data-ck=p]').nth(0).fill('100');
  await adm.click('[data-k=popular]');
  await shot(adm, '24-admin-new-item');
  await adm.click('[data-a=save-item]');
  await adm.waitForSelector('.sheet', { state: 'detached' });
  const np = item('Pizza Merguez');
  ok(np, 'item saved');
  eq(np && np.price, 800, 'empty base price → lowest size price');
  eq(np && np.category_id, mock.db.categories.find(c => c.name === 'Pizzas').id, 'category saved');
  eq(JSON.stringify(np && np.variants.map(v => [v.kind, !!v.multi, v.choices.map(c => [c.label, c.price, c.add, !!c.soldOut])])),
    JSON.stringify([['size', false, [['M', 800, null, false], ['L', 1200, null, false], ['XL', 1700, null, true]]], ['extra', true, [['Fromage', null, 100, false]]]]).replace(/null/g, 'null'),
    'sizes, sold-out XL and extra saved');
  const pth = np && np.photo.split('/object/public/photos/')[1];
  const full = mock.files.get(pth), th = mock.files.get(pth.replace(/(\.\w+)$/, '_t$1'));
  ok(full && full.type === 'image/webp', 'photo stored as WebP');
  ok(full && full.data.length <= 100000, `photo ${(photo.length / 1024 / 1024).toFixed(1)} MB → ${(full.data.length / 1024).toFixed(0)} KB (≤ 100 KB)`);
  ok(th && th.data.length <= 20000, `thumbnail ${(th.data.length / 1024).toFixed(0)} KB (≤ 20 KB)`);
  ok(pth.startsWith('bahia-pizza/'), 'photo saved in the shop folder');

  current = 'Public page shows admin changes';
  console.log(current);
  pub = await phone(browser);
  await pub.goto(BASE); await pub.waitForSelector('.item');
  const card = pub.locator('.item').filter({ has: pub.locator('h3', { hasText: 'Pizza Merguez' }) });
  ok(N(await card.innerText()).includes('dès 800 DA'), 'new item visible with "from 800 DA"');
  ok((await card.locator('img').getAttribute('src')).endsWith('_t.webp'), 'list uses the small thumbnail');
  ok(await pub.locator('.item.out', { hasText: 'Frites' }).count() === 1, 'Frites shows as sold out');
  await card.click();
  ok((await pub.locator('.ihero img').getAttribute('src')).endsWith('.webp') && !(await pub.locator('.ihero img').getAttribute('src')).endsWith('_t.webp'), 'detail uses the full photo');
  ok(await pub.locator('.sheet .chip.dis', { hasText: 'XL' }).isDisabled(), 'sold-out size disabled for customers');
  await shot(pub, '25-live-public-photo');
  ok(!pub.errors.length, 'no JS errors on public page: ' + pub.errors.join(' | '));
  await pub.context().close();

  current = 'Admin: edit, remove photo, delete';
  console.log(current);
  await adm.locator('.row', { hasText: 'Pizza Merguez' }).click();
  await adm.fill('[data-k=price]', '850');
  await adm.click('[data-a=rm-photo]');
  await adm.click('[data-a=save-item]'); await adm.waitForSelector('.sheet', { state: 'detached' });
  eq(item('Pizza Merguez').price, 850, 'price edited');
  eq(item('Pizza Merguez').photo, null, 'photo removed from item');
  await adm.waitForTimeout(200);
  ok(!mock.files.has(pth) && !mock.files.has(pth.replace(/(\.\w+)$/, '_t$1')), 'old photo files deleted from storage');
  await adm.locator('.row', { hasText: 'Pizza Merguez' }).click();
  await adm.click('[data-a=del-item]'); await adm.waitForSelector('.sheet', { state: 'detached' });
  ok(!item('Pizza Merguez'), 'item deleted');
  // existing item round trip: open Tacos, save without change → variants identical (except editor metadata)
  const before = JSON.stringify(item('Tacos').variants.map(v => v.choices));
  await adm.locator('.row', { hasText: 'Tacos' }).first().click(); await adm.click('[data-a=save-item]'); await adm.waitForSelector('.sheet', { state: 'detached' });
  eq(JSON.stringify(item('Tacos').variants.map(v => v.choices)), before, 'saving an untouched item keeps all its options');

  current = 'Admin: categories';
  console.log(current);
  await adm.click('[data-a=tab][data-t=cats]');
  await adm.click('[data-a=new-cat]'); await adm.fill('[data-k=name]', 'Desserts'); await adm.fill('[data-k=icon]', '🍰');
  await adm.click('[data-a=save-cat]'); await adm.waitForSelector('.sheet', { state: 'detached' });
  ok(mock.db.categories.some(c => c.shop_id === 'bahia-pizza' && c.name === 'Desserts'), 'category added');
  const n = await adm.locator('.row').count();
  await adm.click(`[data-a=cat-up][data-i="${n - 1}"]`); await adm.waitForTimeout(300);
  const order = mock.db.categories.filter(c => c.shop_id === 'bahia-pizza').sort((a, b) => a.position - b.position).map(c => c.name);
  eq(order[order.length - 2], 'Desserts', 'category moved up');
  await shot(adm, '26-admin-categories');
  await adm.locator('.row', { hasText: 'Boissons' }).locator('.rbody').click(); await adm.click('[data-a=del-cat]'); await adm.waitForSelector('.sheet', { state: 'detached' });
  ok(!mock.db.categories.some(c => c.name === 'Boissons'), 'category deleted');
  eq(item('Coca-Cola 33cl').category_id, null, 'its items kept, without category');

  current = 'Admin: shop settings';
  console.log(current);
  await adm.click('[data-a=tab][data-t=shop]');
  await adm.fill('[data-p="business.name"]', 'Bahia Pizza Oran');
  await adm.fill('[data-s=wa]', '0661 2');
  await adm.click('[data-a=save-shop]');
  await adm.waitForSelector('.toast.bad');
  ok(true, 'invalid WhatsApp number refused');
  await adm.fill('[data-s=wa]', '0661 22 33 44');
  await adm.fill('[data-o="0"][data-ok=per]', '31=150');
  await shot(adm, '27-admin-shop');
  await adm.click('[data-a=save-shop]'); await adm.waitForSelector('.toast:not(.bad)');
  const st = mock.db.shops.find(s => s.id === 'bahia-pizza').settings;
  eq(st.business.whatsapp, '213661223344', 'WhatsApp saved in international format');
  eq(st.business.name, 'Bahia Pizza Oran', 'name saved');
  eq(JSON.stringify(st.delivery.options[0].fee), '{"31":150,"default":200}', 'per-wilaya fee saved');
  const hasScroll = await adm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!hasScroll, 'admin has no horizontal scroll on a phone');
  ok(!adm.errors.length, 'no JS errors in admin: ' + adm.errors.join(' | '));

  current = 'Security (mock mirrors schema.sql)';
  console.log(current);
  const tk = await adm.evaluate(() => JSON.parse(localStorage.getItem('wo_admin')).access_token);
  const h = { apikey: 'anon-key', Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' };
  let r = await fetch(SBURL + '/rest/v1/items', { method: 'POST', headers: h, body: JSON.stringify({ shop_id: 'lina-style', name: 'x' }) });
  eq(r.status, 403, 'cannot add items to another shop');
  r = await fetch(SBURL + '/rest/v1/shops?id=eq.bahia-pizza', { method: 'PATCH', headers: h, body: JSON.stringify({ owner: B.id }) });
  eq(r.status, 403, 'cannot change shop owner');
  r = await fetch(SBURL + '/storage/v1/object/photos/lina-style/x.webp', { method: 'POST', headers: { ...h, 'Content-Type': 'image/webp' }, body: 'x' });
  eq(r.status, 403, 'cannot upload into another shop folder');
  await adm.context().close();

  current = 'Public page after settings change';
  pub = await phone(browser);
  await pub.goto(BASE); await pub.waitForSelector('.item');
  eq(N(await pub.locator('h1').innerText()), 'Bahia Pizza Oran', 'new name live');
  await pub.context().close();

  await browser.close(); site.close(); mock.server.close();
  const tests = [...new Set(results.map(r => r.test))], pass = results.filter(r => r.ok).length;
  let md = `# Test report — Supabase version\n\n**${pass}/${results.length} checks passed** · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Chromium, Pixel 5 · mock Supabase\n\n`;
  tests.forEach(t => { const rs = results.filter(r => r.test === t); md += `## ${rs.every(r => r.ok) ? '✅' : '❌'} ${t}\n` + rs.map(r => `- ${r.ok ? '✓' : '✗'} ${r.msg}`).join('\n') + '\n\n'; });
  fs.writeFileSync(path.join(__dirname, 'report-live.md'), md);
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
}
run().catch(e => { console.error(e); process.exit(1); });
