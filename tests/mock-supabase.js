/* Tiny in-memory stand-in for the Supabase endpoints this template uses (auth, REST, RPC, storage, edge function).
   Enforces the same rules as supabase/schema.sql (owners, platform admins, closed shops) so the pages are tested against them.
   The "platform" edge function is the REAL supabase/functions/platform/handler.js, pointed at this mock. */
const http = require('http'), crypto = require('crypto');
const SERVICE_KEY = 'service-key';

function createMock({ users, shops, admins = [] }) {
  const db = { shops: [], categories: [], items: [], domains: [], order_events: [] }, files = new Map(), tokens = new Map(), log = [];
  const now = () => new Date().toISOString();
  for (const s of shops) {
    db.shops.push({ id: s.id, owner: s.owner, settings: s.rows.settings, status: s.status || 'active', paid_until: s.paid_until || null, updated_at: now(), created_at: now() });
    db.categories.push(...s.rows.categories);
    db.items.push(...s.rows.items.map(i => ({ ...i, updated_at: now() })));
  }
  const send = (res, code, body, headers = {}) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const isAdmin = u => !!u && admins.includes(u.id);
  const owns = (u, shopId) => !!u && (u.service || isAdmin(u) || !!db.shops.find(s => s.id === shopId && s.owner === u.id));
  const open = id => { const s = db.shops.find(x => x.id === id); return !!s && s.status === 'active' && (!s.paid_until || s.paid_until >= today()); };
  const visible = (u, shopId) => open(shopId) || owns(u, shopId);
  const filterEq = (rows, params) => {
    for (const [k, v] of params) if (/^eq\./.test(v)) rows = rows.filter(r => String(r[k]) === v.slice(3));
    return rows;
  };
  const RESERVED = ['www', 'admin', 'platform', 'app', 'api', 'qr', 'demos', 'lib', 'assets', 'static', 'index', 'config', 'backups', 'supabase'];

  let platformHandler = null;   // loaded lazily (ES module)
  const loadHandler = () => platformHandler || (platformHandler = import('../supabase/functions/platform/handler.js').then(m => m.handle));
  let selfUrl = '';

  const rpcs = {
    is_platform_admin: (u) => [200, isAdmin(u)],
    platform_shops: (u) => {
      if (!isAdmin(u)) return [400, { message: 'platform admins only' }];
      return [200, db.shops.map(s => ({ id: s.id, name: (s.settings.business || {}).name, owner_email: (users.find(x => x.id === s.owner) || {}).email || null,
        status: s.status, paid_until: s.paid_until, open: open(s.id), items: db.items.filter(i => i.shop_id === s.id).length,
        orders_7d: db.order_events.filter(o => o.shop_id === s.id).length, updated_at: s.updated_at, created_at: s.created_at })).reverse()];
    },
    platform_update_shop: (u, b) => {
      if (!isAdmin(u)) return [400, { message: 'platform admins only' }];
      const s = db.shops.find(x => x.id === b.p_id); if (s) { s.status = b.p_status; s.paid_until = b.p_paid_until || null; }
      return [200, null];
    },
    platform_copy_menu: (u, b) => {
      if (!isAdmin(u)) return [400, { message: 'platform admins only' }];
      const map = {};
      db.categories.filter(c => c.shop_id === b.p_from).forEach(c => { map[c.id] = crypto.randomUUID(); db.categories.push({ ...c, id: map[c.id], shop_id: b.p_to }); });
      const its = db.items.filter(i => i.shop_id === b.p_from);
      its.forEach(i => db.items.push({ ...i, id: crypto.randomUUID(), shop_id: b.p_to, category_id: map[i.category_id] || null }));
      const f = db.shops.find(x => x.id === b.p_from), t = db.shops.find(x => x.id === b.p_to);
      t.settings = { ...t.settings, colors: f.settings.colors, theme: f.settings.theme, delivery: f.settings.delivery };
      return [200, its.length];
    },
    create_shop: (u, b) => {
      if (!u || !u.service) return [401, { message: 'permission denied for function create_shop' }];
      const owner = users.find(x => x.email.toLowerCase() === String(b.p_email).toLowerCase());
      if (!owner) return [400, { message: 'No user with email' }];
      if (RESERVED.includes(b.p_id) || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(b.p_id)) return [400, { message: 'violates check constraint' }];
      db.shops.push({ id: b.p_id, owner: owner.id, status: 'active', paid_until: null, updated_at: now(), created_at: now(),
        settings: { mode: b.p_mode, lang: 'fr', languages: ['fr', 'ar'], currency: 'DA', currency_ar: 'دج', business: { name: b.p_name, logo: b.p_mode === 'shop' ? '🛍️' : '🍽️', whatsapp: '' },
          colors: { primary: '#c1121f', accent: '#f77f00' }, delivery: { wilayas: [], freeAbove: 0, minOrder: 0, options: [{ id: 'home', label: 'Livraison', label_ar: 'توصيل', fee: 0, address: true }] } } });
      return [200, 'OK'];
    },
    log_order: (u, b) => {
      if (open(b.p_shop) && db.order_events.filter(o => o.shop_id === b.p_shop).length < 300) db.order_events.push({ shop_id: b.p_shop, total: b.p_total, at: now() });
      return [204];
    },
    order_stats: (u, b) => {
      if (!owns(u, b.p_shop) || (u && u.service)) return [400, { message: 'not your shop' }];
      const ev = db.order_events.filter(o => o.shop_id === b.p_shop);
      return [200, { today: ev.length, week: ev.length, month: ev.length, month_total: ev.reduce((n, o) => n + (+o.total || 0), 0) }];
    }
  };

  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, undefined, { 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' });
    const u = new URL(req.url, 'http://x'), chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks), json = () => JSON.parse(raw.toString() || '{}');
      log.push({ method: req.method, path: u.pathname, search: u.search, size: raw.length, type: req.headers['content-type'] });

      // ---- public photos (no key needed, like real Supabase public buckets)
      if (u.pathname.startsWith('/storage/v1/object/public/photos/')) {
        const f = files.get(u.pathname.slice('/storage/v1/object/public/photos/'.length));
        if (!f) return send(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': f.type, 'Access-Control-Allow-Origin': '*' }); return res.end(f.data);
      }

      // ---- the platform edge function (real handler code)
      if (u.pathname === '/functions/v1/platform') {
        const handle = await loadHandler();
        const r = await handle(new Request('http://fn' + u.pathname, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw }),
          { SUPABASE_URL: selfUrl, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY });
        res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
      }

      const service = req.headers.apikey === SERVICE_KEY;
      if (req.headers.apikey !== 'anon-key' && !service) return send(res, 401, { message: 'No API key' });

      // ---- auth
      if (u.pathname === '/auth/v1/token') {
        const b = json(), g = u.searchParams.get('grant_type');
        let user;
        if (g === 'password') user = users.find(x => x.email === b.email && x.password === b.password);
        if (g === 'refresh_token') user = tokens.get('r:' + b.refresh_token);
        if (!user) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        const at = crypto.randomUUID(), rt = crypto.randomUUID();
        tokens.set(at, user); tokens.set('r:' + rt, user);
        return send(res, 200, { access_token: at, refresh_token: rt, expires_in: 3600, user: { id: user.id, email: user.email } });
      }
      if (u.pathname.startsWith('/auth/v1/admin/users')) {
        if (!service) return send(res, 403, { message: 'service role only' });
        const b = json();
        if (req.method === 'POST') {
          if (users.find(x => x.email.toLowerCase() === b.email.toLowerCase())) return send(res, 422, { code: 'email_exists', msg: 'A user with this email address has already been registered' });
          const nu = { id: crypto.randomUUID(), email: b.email, password: b.password }; users.push(nu); return send(res, 200, { id: nu.id, email: nu.email });
        }
        if (req.method === 'PUT') {
          const x = users.find(v => v.id === u.pathname.split('/').pop()); if (!x) return send(res, 404, { msg: 'not found' });
          x.password = b.password; return send(res, 200, { id: x.id });
        }
      }
      const user = service ? { service: true } : (tokens.get((req.headers.authorization || '').replace('Bearer ', '')) || null);

      // ---- RPC
      const rm = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
      if (rm) {
        const f = rpcs[rm[1]]; if (!f) return send(res, 404, { message: 'no function' });
        const [code, body] = f(user, req.method === 'POST' ? json() : {});
        return send(res, code, body);
      }

      if (u.pathname.startsWith('/storage/v1/object/photos')) {
        if (!user) return send(res, 401, { message: 'unauthorized' });
        if (req.method === 'POST') {
          const p = u.pathname.slice('/storage/v1/object/photos/'.length);
          if (!owns(user, p.split('/')[0])) return send(res, 403, { message: 'row-level security' });
          if (raw.length > 400000) return send(res, 413, { message: 'too large' });
          files.set(p, { data: raw, type: req.headers['content-type'] }); return send(res, 200, { Key: 'photos/' + p });
        }
        if (req.method === 'DELETE') {
          for (const p of json().prefixes || []) if (owns(user, p.split('/')[0])) files.delete(p);
          return send(res, 200, []);
        }
      }

      // ---- REST
      const m = u.pathname.match(/^\/rest\/v1\/(shops|categories|items|domains)$/);
      if (!m) return send(res, 404, { message: 'unknown route' });
      const t = m[1], params = [...u.searchParams].filter(([k]) => k !== 'select' && k !== 'order');
      if (req.method === 'GET') {
        let rows = filterEq(db[t], params).map(r => ({ ...r }));
        if (t === 'categories' || t === 'items') rows = rows.filter(r => visible(user, r.shop_id));
        if (t === 'shops' && /categories/.test(u.searchParams.get('select') || ''))
          rows = rows.map(s => visible(user, s.id) ? { ...s, categories: db.categories.filter(c => c.shop_id === s.id), items: db.items.filter(i => i.shop_id === s.id) } : { ...s, categories: [], items: [] });
        return send(res, 200, rows);
      }
      if (!user) return send(res, 401, { message: 'unauthorized' });
      if (req.method === 'POST') {
        const row = json();
        if (t === 'shops' || t === 'domains' || !owns(user, row.shop_id)) return send(res, 403, { message: 'new row violates row-level security policy' });
        const full = { id: crypto.randomUUID(), position: 0, ...(t === 'items' ? { variants: [], available: true, popular: false, hidden: false, price: 0 } : {}), ...row };
        db[t].push(full); return send(res, 201, [full]);
      }
      const targets = filterEq(db[t], params).filter(r => owns(user, t === 'shops' ? r.id : r.shop_id));
      if (req.method === 'PATCH') {
        const b = json();
        if (t === 'shops' && Object.keys(b).some(k => k !== 'settings')) return send(res, 403, { message: 'permission denied for column' });
        targets.forEach(r => Object.assign(r, b, { updated_at: now() }));
        return send(res, 200, targets);
      }
      if (req.method === 'DELETE') {
        const ids = new Set(targets.map(r => r.id));
        db[t] = db[t].filter(r => !ids.has(r.id));
        if (t === 'categories') db.items.forEach(i => { if (ids.has(i.category_id)) i.category_id = null; });
        return send(res, 204);
      }
      send(res, 405, {});
    });
  });
  server.on('listening', () => { selfUrl = 'http://localhost:' + server.address().port; });
  return { server, db, files, log, users };
}
module.exports = { createMock, SERVICE_KEY };
