/* Tiny in-memory stand-in for the Supabase endpoints this template uses (auth, REST, storage).
   Enforces the same ownership rules as supabase/schema.sql so the admin is tested against them. */
const http = require('http'), crypto = require('crypto');

function createMock({ users, shops }) {
  const db = { shops: [], categories: [], items: [] }, files = new Map(), tokens = new Map(), log = [];
  for (const s of shops) {
    db.shops.push({ id: s.id, owner: s.owner, settings: s.rows.settings, updated_at: new Date().toISOString() });
    db.categories.push(...s.rows.categories);
    db.items.push(...s.rows.items.map(i => ({ ...i, updated_at: new Date().toISOString() })));
  }
  const send = (res, code, body, headers = {}) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const userOf = req => tokens.get((req.headers.authorization || '').replace('Bearer ', '')) || null;
  const owns = (uid, shopId) => !!db.shops.find(s => s.id === shopId && s.owner === uid);
  const filterEq = (rows, params) => {
    for (const [k, v] of params) if (/^eq\./.test(v)) rows = rows.filter(r => String(r[k]) === v.slice(3));
    return rows;
  };

  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, undefined, { 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' });
    const u = new URL(req.url, 'http://x'), chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks), json = () => JSON.parse(raw.toString() || '{}');
      log.push({ method: req.method, path: u.pathname, search: u.search, size: raw.length, type: req.headers['content-type'] });

      // ---- public photos (no key needed, like real Supabase public buckets)
      if (u.pathname.startsWith('/storage/v1/object/public/photos/')) {
        const f = files.get(u.pathname.slice('/storage/v1/object/public/photos/'.length));
        if (!f) return send(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': f.type, 'Access-Control-Allow-Origin': '*' }); return res.end(f.data);
      }
      if (req.headers.apikey !== 'anon-key') return send(res, 401, { message: 'No API key' });

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
      const user = userOf(req);

      if (u.pathname.startsWith('/storage/v1/object/photos')) {
        if (!user) return send(res, 401, { message: 'unauthorized' });
        if (req.method === 'POST') {
          const p = u.pathname.slice('/storage/v1/object/photos/'.length);
          if (!owns(user.id, p.split('/')[0])) return send(res, 403, { message: 'row-level security' });
          if (raw.length > 400000) return send(res, 413, { message: 'too large' });
          files.set(p, { data: raw, type: req.headers['content-type'] }); return send(res, 200, { Key: 'photos/' + p });
        }
        if (req.method === 'DELETE') {
          for (const p of json().prefixes || []) if (owns(user.id, p.split('/')[0])) files.delete(p);
          return send(res, 200, []);
        }
      }

      // ---- REST
      const m = u.pathname.match(/^\/rest\/v1\/(shops|categories|items)$/);
      if (!m) return send(res, 404, { message: 'unknown route' });
      const t = m[1], params = [...u.searchParams].filter(([k]) => k !== 'select');
      if (req.method === 'GET') {
        let rows = filterEq(db[t], params).map(r => ({ ...r }));
        if (t === 'shops' && /categories/.test(u.searchParams.get('select') || ''))
          rows = rows.map(s => ({ ...s, categories: db.categories.filter(c => c.shop_id === s.id), items: db.items.filter(i => i.shop_id === s.id) }));
        return send(res, 200, rows);
      }
      if (!user) return send(res, 401, { message: 'unauthorized' });
      if (req.method === 'POST') {
        const row = json();
        if (t === 'shops' || !owns(user.id, row.shop_id)) return send(res, 403, { message: 'new row violates row-level security policy' });
        const full = { id: crypto.randomUUID(), position: 0, ...(t === 'items' ? { variants: [], available: true, popular: false, hidden: false, price: 0 } : {}), ...row };
        db[t].push(full); return send(res, 201, [full]);
      }
      const targets = filterEq(db[t], params).filter(r => owns(user.id, t === 'shops' ? r.id : r.shop_id));
      if (req.method === 'PATCH') {
        const b = json();
        if (t === 'shops' && Object.keys(b).some(k => k !== 'settings')) return send(res, 403, { message: 'permission denied for column' });
        targets.forEach(r => Object.assign(r, b, { updated_at: new Date().toISOString() }));
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
  return { server, db, files, log };
}
module.exports = { createMock };
