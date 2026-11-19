// Platform actions that need the secret (service role) key. Only platform admins may call them.
// Plain JS so it runs in Supabase (Deno) and in the Node tests. The key never leaves the server.
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;
const RESERVED = ['www', 'admin', 'platform', 'app', 'api', 'qr', 'demos', 'lib', 'assets', 'static', 'index', 'config', 'backups', 'supabase'];
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function handle(req, env, fetchFn = fetch) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const SB = String(env.SUPABASE_URL || '').replace(/\/$/, ''), SR = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB || !SR) return json({ error: 'server not configured' }, 500);
  const svc = { apikey: SR, Authorization: 'Bearer ' + SR, 'Content-Type': 'application/json' };
  const caller = { apikey: req.headers.get('apikey') || SR, Authorization: req.headers.get('authorization') || '', 'Content-Type': 'application/json' };

  // 1) the caller must be a platform admin (checked with their own login token)
  const chk = await fetchFn(SB + '/rest/v1/rpc/is_platform_admin', { method: 'POST', headers: caller, body: '{}' });
  if (!chk.ok || (await chk.json()) !== true) return json({ error: 'Réservé à l\'administrateur de la plateforme' }, 403);

  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const ownerOf = async id => {
    const r = await fetchFn(SB + '/rest/v1/shops?id=eq.' + encodeURIComponent(id) + '&select=id,owner', { headers: svc });
    const rows = r.ok ? await r.json() : [];
    return rows[0] || null;
  };

  if (b.action === 'create_shop') {
    const id = String(b.id || '').trim().toLowerCase(), email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim();
    const mode = b.mode === 'shop' ? 'shop' : 'menu', password = String(b.password || '');
    if (!SLUG.test(id) || RESERVED.includes(id)) return json({ error: 'Lien invalide : lettres minuscules, chiffres et tirets (2 à 40).' }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email invalide' }, 400);
    if (!name) return json({ error: 'Nom obligatoire' }, 400);
    if (password.length < 8) return json({ error: 'Mot de passe : 8 caractères minimum' }, 400);
    if (await ownerOf(id)) return json({ error: 'Ce lien est déjà pris : ' + id }, 409);

    let reused = false;
    const cu = await fetchFn(SB + '/auth/v1/admin/users', { method: 'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) });
    if (!cu.ok) {
      const t = await cu.text();
      if (!/already|exists|registered/i.test(t)) return json({ error: 'Création du compte impossible : ' + t.slice(0, 160) }, 400);
      reused = true;                       // same owner, second shop: keeps their current password
    }
    const cs = await fetchFn(SB + '/rest/v1/rpc/create_shop', { method: 'POST', headers: svc, body: JSON.stringify({ p_id: id, p_email: email, p_name: name, p_mode: mode }) });
    if (!cs.ok) return json({ error: 'Création de la boutique impossible : ' + (await cs.text()).slice(0, 160) }, 400);
    let copied = 0;
    if (b.copy_from) {
      const cp = await fetchFn(SB + '/rest/v1/rpc/platform_copy_menu', { method: 'POST', headers: caller, body: JSON.stringify({ p_from: b.copy_from, p_to: id }) });
      if (cp.ok) copied = await cp.json();
    }
    return json({ ok: true, id, email, reused, copied });
  }

  if (b.action === 'set_password') {
    const shop = await ownerOf(String(b.id || ''));
    if (!shop || !shop.owner) return json({ error: 'Boutique sans propriétaire' }, 404);
    if (String(b.password || '').length < 8) return json({ error: 'Mot de passe : 8 caractères minimum' }, 400);
    const r = await fetchFn(SB + '/auth/v1/admin/users/' + shop.owner, { method: 'PUT', headers: svc, body: JSON.stringify({ password: b.password }) });
    if (!r.ok) return json({ error: 'Échec : ' + (await r.text()).slice(0, 160) }, 400);
    return json({ ok: true });
  }

  return json({ error: 'unknown action' }, 400);
}
