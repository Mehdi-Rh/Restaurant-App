// Netlify Edge Function: gives each restaurant link its own title, WhatsApp/Facebook preview,
// phone icon and app manifest, before any script runs. Menu data still loads in the browser.
import { parseConfig, slugFrom, isCustomHost, brandInfo, brandHtml, manifest } from './core.js';

const TTL = 5 * 60 * 1000;          // shop branding is cached 5 minutes per edge instance
const cache = new Map();
export const _cache = cache;   // for tests
let cfgPromise = null;

function config(origin) {
  const env = globalThis.Netlify && Netlify.env;
  const url = env && env.get('SUPABASE_URL'), key = env && env.get('SUPABASE_KEY');
  if (!cfgPromise) cfgPromise = fetch(origin + '/config.js').then(r => r.text()).then(parseConfig)
    .then(c => (url && key ? { ...c, url, key } : c)).catch(e => { cfgPromise = null; throw e; });
  return cfgPromise;
}
async function cached(k, load) {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const v = await load(); cache.set(k, { v, at: Date.now() }); return v;
}
async function sb(cfg, path) {
  const r = await fetch(cfg.url + '/rest/v1/' + path, { headers: { apikey: cfg.key } });
  if (!r.ok) throw new Error('supabase ' + r.status);
  return r.json();
}
async function shopInfo(cfg, url) {
  let slug = slugFrom(url, cfg);
  if (!slug && isCustomHost(url.hostname, cfg)) {
    slug = await cached('d:' + url.hostname, async () => ((await sb(cfg, 'domains?host=eq.' + encodeURIComponent(url.hostname) + '&select=shop_id'))[0] || {}).shop_id || null);
  }
  if (!slug) return null;
  return cached('s:' + slug, async () => {
    const rows = await sb(cfg, 'shops?id=eq.' + encodeURIComponent(slug) + '&select=settings');
    return rows.length ? brandInfo(rows[0].settings || {}, slug) : null;
  });
}

export default async (request, context) => {
  const url = new URL(request.url);
  let res = null;
  try {
    if (url.pathname === '/manifest.webmanifest') {
      const info = await shopInfo(await config(url.origin), url);
      if (!info) return new Response('{}', { status: 404, headers: { 'content-type': 'application/manifest+json' } });
      return new Response(JSON.stringify(manifest(info)), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=300' } });
    }
    res = await context.next();
    if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
    const info = await shopInfo(await config(url.origin), url);
    if (!info) return res;
    const html = brandHtml(await res.text(), info, url.origin + url.pathname);
    const headers = new Headers(res.headers); headers.delete('content-length'); headers.delete('etag');
    return new Response(html, { status: res.status, headers });
  } catch (e) {
    console.log('brand edge function:', e.message);
    return res || context.next();     // never break the menu because of branding
  }
};
