/* End-to-end tests. Run:  node tests/e2e.js   (needs: npm i playwright; optional: jsqr pngjs)
   Serves the folder on :8765, drives Chromium as a phone, writes tests/screenshots/ + tests/report.md */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), SHOTS = path.join(__dirname, 'screenshots'), PORT = 8765;
const BASE = `http://localhost:${PORT}/`;
let jsQR, PNG; try { jsQR = require('jsqr'); PNG = require('pngjs').PNG; } catch (e) {}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

const results = []; let current = '';
function ok(cond, msg) { results.push({ test: current, ok: !!cond, msg }); if (!cond) console.log('  ✗ ' + msg); }
function eq(a, b, msg) { ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ ...devices['Pixel 5'], acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.waUrls = [];
  await ctx.route('https://wa.me/**', route => { page.waUrls.push(route.request().url()); route.fulfill({ contentType: 'text/html', body: '<p>wa.me stub</p>' }); });
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const N = s => String(s).replace(/\u00a0/g, ' ');
const msgOf = url => N(decodeURIComponent(url.split('?text=')[1]));
const cartbar = async page => N(await page.locator('.cartbar').innerText());
const itemEl = (page, name) => page.locator('.item').filter({ has: page.locator('h3', { hasText: name }) }).first();
async function openItem(page, name) { await itemEl(page, name).click(); }
async function chip(page, label) { await page.locator('.sheet .chip', { hasText: label }).first().click(); }

async function run() {
  fs.mkdirSync(SHOTS, { recursive: true });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();

  /* 1. Restaurant, French */
  current = 'Restaurant FR: menu → options → cart → WhatsApp';
  console.log(current);
  let page = await newPage(browser);
  await page.goto(BASE + 'demos/bahia-pizza/');
  ok(await page.locator('.demo').isVisible(), 'demo banner shown');
  eq(await page.locator('.cats a').count(), 5, 'category chips');
  eq(await page.locator('html').getAttribute('dir'), 'ltr', 'LTR in French');
  await shot(page, '01-pizza-menu-fr');
  await openItem(page, 'Margherita');
  ok(await page.locator('.sheet').isVisible(), 'item sheet opens');
  await chip(page, 'L'); await page.click('[data-act=qp]');
  ok(N(await page.locator('[data-act=addline]').innerText()).includes('1 800 DA'), 'sheet total 2 × L = 1 800 DA');
  await shot(page, '02-pizza-item-sheet');
  await page.click('[data-act=addline]');
  ok((await cartbar(page)).includes('1 800 DA'), 'cart bar total 1 800');
  await openItem(page, 'Tacos');
  await chip(page, 'Double'); await chip(page, 'Mixte'); await chip(page, 'Cheddar');
  ok(N(await page.locator('[data-act=addline]').innerText()).includes('830 DA'), 'tacos Double+Mixte+Cheddar = 830');
  await page.click('[data-act=addline]');
  await openItem(page, 'Frites');            // no options → direct add
  await openItem(page, "Jus d'orange");      // sold out → nothing
  ok(!(await page.locator('.sheet').count()), 'sold-out item does not open');
  eq(N(await page.locator('.cartbar .cnt').innerText()).trim(), '4', 'cart count 4');
  ok((await cartbar(page)).includes('2 780 DA'), 'subtotal 2 780');
  await openItem(page, 'Viande hachée');
  ok(await page.locator('.sheet .chip.dis', { hasText: 'XL' }).isDisabled(), 'sold-out size XL disabled');
  await page.click('.sheet .x');

  await page.click('.cartbar');
  ok(N(await page.locator('.tot').innerText()).includes('2 980 DA'), 'total with 200 DA delivery = 2 980');
  eq(await page.locator('#f-wilaya').count(), 0, 'single wilaya (Oran) → no wilaya select');
  await page.click('[data-act=send]');
  eq(await page.locator('.fld.err').count(), 3, 'empty form → 3 errors (name, phone, address)');
  eq(page.waUrls.length, 0, 'no WhatsApp opened when invalid');
  await page.fill('#f-name', 'Karim Benali');
  await page.fill('#f-phone', '12345');
  await page.fill('#f-address', 'Hai Khemisti, bâtiment 12');
  await page.click('[data-act=send]');
  ok(N(await page.locator('.fld.err').innerText()).includes('invalide'), 'bad phone rejected');
  await page.fill('#f-phone', '+213 555 12 34 56');
  await page.waitForTimeout(300); await shot(page, '03-pizza-cart-fr');
  await page.click('[data-act=send]');
  await page.waitForTimeout(300);
  eq(page.waUrls.length, 1, 'WhatsApp link opened');
  let url = page.waUrls[0], msg = msgOf(url);
  ok(url.startsWith('https://wa.me/?text='), 'demo mode → no business number (contact chooser)');
  ['Nouvelle commande #', 'Bahia Pizza', '2 × Margherita (L) : 1 800 DA', '1 × Tacos (Taille: Double, Viande: Mixte, Suppléments: Cheddar) : 830 DA',
   '1 × Frites : 150 DA', 'Sous-total : 2 780 DA', 'Livraison : 200 DA', '*Total : 2 980 DA*', 'Client : Karim Benali', 'Tél : 0555 12 34 56',
   'Mode : Livraison', 'Wilaya : 31 - Oran', 'Adresse : Hai Khemisti, bâtiment 12'].forEach(s => ok(msg.includes(s), 'message has: ' + s));
  fs.writeFileSync(path.join(SHOTS, 'message-fr.txt'), msg);

  current = 'Restaurant: back from WhatsApp, persistence, free delivery, pickup, minimum';
  console.log(current);
  await page.goBack(); await page.waitForSelector('.sheet');
  ok(N(await page.locator('.sheet').innerText()).includes('Commande prête'), '"order ready" screen restored after back');
  await shot(page, '04-pizza-done');
  await page.click('.sheet .x');
  await page.reload();
  ok((await cartbar(page)).includes('2 780 DA'), 'cart survives reload');
  await openItem(page, 'Panini'); await openItem(page, 'Panini');   // 2 780 + 600 = 3 380 ≥ 3 000
  await page.click('.cartbar');
  ok(await page.inputValue('#f-name') === 'Karim Benali', 'customer details remembered');
  ok(N(await page.locator('.tot').innerText()).includes('Gratuite'), 'free delivery above 3 000 DA');
  await page.click('[data-act=opt][data-o=pickup]');
  eq(await page.locator('#f-address').count(), 0, 'pickup → no address field');
  await page.click('[data-act=send]'); await page.waitForTimeout(200);
  msg = msgOf(page.waUrls[1]);
  ok(msg.includes('Mode : À emporter') && !msg.includes('Adresse'), 'pickup message has no address');
  await page.goBack(); await page.waitForSelector('.sheet');
  await page.click('[data-act=finish]');
  eq(await page.locator('.cartbar').count(), 0, 'finish empties cart');
  await openItem(page, 'Frites'); await page.click('.cartbar');
  ok(await page.locator('[data-act=send]').isDisabled(), 'below 500 DA minimum → send disabled');
  ok(!page.errors.length, 'no JS errors: ' + page.errors.join(' | '));
  await page.context().close();

  /* 2. Restaurant, Arabic / RTL */
  current = 'Restaurant AR: RTL + Arabic message';
  console.log(current);
  page = await newPage(browser);
  await page.goto(BASE + 'demos/bahia-pizza/');
  await page.click('[data-act=lang]');
  eq(await page.locator('html').getAttribute('dir'), 'rtl', 'RTL in Arabic');
  ok(N(await page.locator('h1').innerText()).includes('باهية'), 'Arabic business name');
  await shot(page, '05-pizza-menu-ar');
  await openItem(page, 'تونة'); await chip(page, 'XL'); await page.click('[data-act=addline]');
  await openItem(page, 'طاكوس'); await page.click('[data-act=addline]');
  await page.click('.cartbar');
  await page.fill('#f-name', 'محمد'); await page.fill('#f-phone', '0661 22 33 44'); await page.fill('#f-address', 'حي الصباح، وهران');
  await page.waitForTimeout(300); await shot(page, '06-pizza-cart-ar');
  await page.click('[data-act=send]'); await page.waitForTimeout(200);
  msg = msgOf(page.waUrls[0]);
  ['طلب جديد', 'باهية بيتزا', '1 × تونة (XL) : 1 500 دج', '1 × طاكوس (الحجم: عادي، اللحم: دجاج)', 'الزبون : محمد', '0661 22 33 44', 'الولاية : 31 - وهران']
    .forEach(s => ok(msg.includes(s), 'AR message has: ' + s));
  ok(msg.split('\n').filter(Boolean).every(l => l.startsWith('‏')), 'every AR line starts with RTL mark');
  fs.writeFileSync(path.join(SHOTS, 'message-ar.txt'), msg);
  ok(!page.errors.length, 'no JS errors: ' + page.errors.join(' | '));
  await page.context().close();

  /* 3. Clothing shop */
  current = 'Shop: sizes/colors, 58 wilayas, fees, stop desk, Arabic digits';
  console.log(current);
  page = await newPage(browser);
  await page.goto(BASE + 'demos/lina-style/');
  await shot(page, '07-shop-grid');
  await openItem(page, 'Ensemble jogging');
  ok(await page.locator('.sheet .chip.dis', { hasText: 'XL' }).isDisabled(), 'XL sold out');
  ok(await page.locator('.sheet .sw').count() >= 3, 'color swatches');
  await chip(page, 'M'); await chip(page, 'Noir');
  await shot(page, '08-shop-item');
  await page.click('[data-act=addline]');
  await openItem(page, 'Abaya'); await chip(page, 'Grande taille');
  ok(N(await page.locator('[data-act=addline]').innerText()).includes('7 000 DA'), 'abaya large size +500 = 7 000');
  await page.click('[data-act=addline]');
  await page.click('.cartbar');
  eq(await page.locator('#f-wilaya option').count(), 59, '58 wilayas + placeholder');
  ok(N(await page.locator('.tot').innerText()).includes('—'), 'fee unknown before wilaya');
  await page.selectOption('#f-wilaya', '16');
  ok(N(await page.locator('.tot').innerText()).includes('500 DA'), 'Alger home = 500');
  await page.selectOption('#f-wilaya', '11');
  ok(N(await page.locator('.tot').innerText()).includes('1 500 DA'), 'Tamanrasset home = 1 500');
  await page.click('[data-act=opt][data-o=desk]');
  ok(N(await page.locator('.tot').innerText()).includes('12 500 DA'), 'Tamanrasset desk = 1 000 → total 12 500');
  await page.fill('#f-name', 'Amina'); await page.fill('#f-phone', '٠٧٧٠١٢٣٤٥٦'); await page.fill('#f-address', 'Centre ville');
  await page.waitForTimeout(300); await shot(page, '09-shop-cart');
  await page.click('[data-act=send]'); await page.waitForTimeout(200);
  msg = msgOf(page.waUrls[0]);
  ['1 × Ensemble jogging oversize (Taille: M, Couleur: Noir) : 4 500 DA', 'Wilaya : 11 - Tamanrasset', 'Mode : Bureau (stop desk)', 'Livraison : 1 000 DA', 'Tél : 0770 12 34 56', '*Total : 12 500 DA*']
    .forEach(s => ok(msg.includes(s), 'shop message has: ' + s));
  fs.writeFileSync(path.join(SHOTS, 'message-shop.txt'), msg);
  ok(!page.errors.length, 'no JS errors: ' + page.errors.join(' | '));
  await page.context().close();

  /* 4. Admin */
  current = 'Admin: edit, options parser, preview, export';
  console.log(current);
  page = await newPage(browser);
  page.on('dialog', d => d.accept());
  await page.goto(BASE + 'admin.html');
  await shot(page, '10-admin');
  const rt = await page.evaluate(() => {
    const A = window.__admin, bad = [];
    [window.CONFIG].forEach(c => c.items.forEach(it => { if (!it.variants) return;
      const back = A.textToVar(A.varToText(it.variants)); if (JSON.stringify(back) !== JSON.stringify(it.variants)) bad.push(it.id); }));
    return { bad, p: A.textToVar('Couleur|اللون: Noir|أسود #111111=900, Rouge+50!\nSupp*: Œuf+50'), f: A.parseFees(800, '16=500, 9=450') };
  });
  eq(rt.bad.join(','), '', 'options text round-trips for every demo item');
  eq(JSON.stringify(rt.p), JSON.stringify([{ name: 'Couleur', name_ar: 'اللون', choices: [{ label: 'Noir', label_ar: 'أسود', price: 900, color: '#111111' }, { label: 'Rouge', add: 50, soldOut: true }] }, { name: 'Supp', multi: true, choices: [{ label: 'Œuf', add: 50 }] }]), 'options parser');
  eq(JSON.stringify(rt.f), '{"16":500,"09":450,"default":800}', 'per-wilaya fee parser');
  const priceInput = page.locator('[data-p="items.9.price"]');
  await priceInput.fill('180');
  await page.fill('[data-p="business.name"]', 'Chez Test');
  await page.locator('[data-a=itemadd]').first().click();
  const n = await page.evaluate(() => window.__admin.get().items.length - 1);
  await page.fill(`[data-p="items.${n}.name"]`, 'Pizza Spéciale'); await page.fill(`[data-p="items.${n}.price"]`, '1200');
  await page.fill(`[data-a=vars][data-i="${n}"]`, 'Taille: M=1200, L=1600');
  await page.locator(`[data-p="items.${n}.name"]`).blur();
  const [pv] = await Promise.all([page.context().waitForEvent('page'), page.click('#b-preview')]);
  await pv.waitForLoadState();
  ok(N(await pv.locator('h1').innerText()) === 'Chez Test', 'preview shows edited name');
  ok(N(await itemEl(pv, 'Frites').innerText()).includes('180 DA'), 'preview shows edited price');
  ok(N(await itemEl(pv, 'Pizza Spéciale').innerText()).includes('1 200 DA'), 'preview shows new item');
  await pv.close();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#b-export')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8'); const w = {}; new Function('window', txt)(w);
  eq(w.CONFIG.business.name, 'Chez Test', 'exported config.js is valid and has edits');
  eq(w.CONFIG.items[n].id, 'pizza-speciale', 'new item gets clean id');
  eq(JSON.stringify(w.CONFIG.items[n].variants), JSON.stringify([{ name: 'Taille', choices: [{ label: 'M', price: 1200 }, { label: 'L', price: 1600 }] }]), 'new item options exported');
  ok(!page.errors.length, 'no JS errors: ' + page.errors.join(' | '));
  await page.context().close();

  /* 5. QR */
  current = 'QR generator';
  console.log(current);
  page = await newPage(browser, { viewport: { width: 420, height: 900 } });
  await page.goto(BASE + 'qr.html');
  await page.fill('#url', 'https://bahia-pizza.netlify.app/');
  await shot(page, '11-qr');
  const [qd] = await Promise.all([page.waitForEvent('download'), page.click('#dlq')]);
  const [pd] = await Promise.all([page.waitForEvent('download'), page.click('#dl')]);
  fs.copyFileSync(await pd.path(), path.join(SHOTS, '12-qr-poster.png'));
  if (jsQR) {
    const png = PNG.sync.read(fs.readFileSync(await qd.path()));
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    eq(code && code.data, 'https://bahia-pizza.netlify.app/', 'QR decodes to the link');
    const poster = PNG.sync.read(fs.readFileSync(await pd.path()));
    const c2 = jsQR(new Uint8ClampedArray(poster.data), poster.width, poster.height);
    eq(c2 && c2.data, 'https://bahia-pizza.netlify.app/', 'poster QR decodes too');
  } else ok(true, 'QR decode skipped (jsqr not installed)');
  ok(!page.errors.length, 'no JS errors: ' + page.errors.join(' | '));
  await page.context().close();

  /* 6. Performance on slow 3G */
  current = 'Performance: page weight + slow 3G load';
  console.log(current);
  for (const demo of ['bahia-pizza', 'lina-style']) {
    page = await newPage(browser);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
    let bytes = 0; cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; });
    const t0 = Date.now(); await page.goto(BASE + 'demos/' + demo + '/', { waitUntil: 'load' }); const ms = Date.now() - t0;
    await page.waitForSelector('.item');
    ok(bytes < 80 * 1024, `${demo}: total transfer ${(bytes / 1024).toFixed(1)} KB (< 80 KB, uncompressed)`);
    ok(ms < 6000, `${demo}: loads in ${(ms / 1000).toFixed(1)} s on slow 3G (400 kbps, 400 ms latency)`);
    await page.context().close();
  }

  /* 7. Desktop look */
  current = 'Desktop layout';
  page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto(BASE + 'demos/lina-style/'); await shot(page, '13-shop-desktop');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll on desktop');
  await page.close();
  page = await newPage(browser);
  await page.goto(BASE + 'demos/lina-style/');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll on phone');
  await page.context().close();

  await browser.close(); server.close();

  // report
  const tests = [...new Set(results.map(r => r.test))];
  const pass = results.filter(r => r.ok).length;
  let md = `# Test report\n\n**${pass}/${results.length} checks passed** · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Chromium, Pixel 5 emulation\n\n`;
  tests.forEach(t => { const rs = results.filter(r => r.test === t); md += `## ${rs.every(r => r.ok) ? '✅' : '❌'} ${t}\n` + rs.map(r => `- ${r.ok ? '✓' : '✗'} ${r.msg}`).join('\n') + '\n\n'; });
  fs.writeFileSync(path.join(__dirname, 'report.md'), md);
  console.log(`\n${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
}
run().catch(e => { console.error(e); server.close(); process.exit(1); });
