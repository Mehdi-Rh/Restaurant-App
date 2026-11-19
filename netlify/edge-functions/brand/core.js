// Pure helpers for the "brand" edge function (also imported by tests under Node).
export const RESERVED = ['www', 'admin', 'platform', 'app', 'api', 'qr', 'demos', 'lib', 'assets', 'static', 'index', 'config', 'backups', 'supabase'];
const SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function parseConfig(js) {
  const get = k => (new RegExp(k + '\\s*:\\s*["\']([^"\']*)["\']').exec(js) || [])[1] || '';
  return { url: get('url').replace(/\/$/, ''), key: get('key'), baseDomain: get('baseDomain'), defaultShop: get('defaultShop') };
}

// same rules as app.js: ?shop= → /slug → slug.baseDomain ; null = maybe a custom domain
export function slugFrom(url, cfg) {
  const q = url.searchParams.get('shop');
  if (q && SLUG.test(q)) return q;
  const seg = url.pathname.split('/')[1] || '';
  if (SLUG.test(seg) && !RESERVED.includes(seg)) return seg;
  const host = url.hostname.toLowerCase(), bd = cfg.baseDomain;
  if (bd && host.endsWith('.' + bd)) { const sub = host.slice(0, -bd.length - 1); if (SLUG.test(sub) && !RESERVED.includes(sub)) return sub; }
  if (url.pathname === '/' && cfg.defaultShop && !isCustomHost(host, cfg)) return cfg.defaultShop;
  return null;
}
export function isCustomHost(host, cfg) {
  if (!host || host === 'localhost' || /^[\d.]+$/.test(host) || host.endsWith('.netlify.app')) return false;
  return !(cfg.baseDomain && (host === cfg.baseDomain || host.endsWith('.' + cfg.baseDomain)));
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isUrl = v => /^https:\/\//.test(v || '');

export function brandInfo(settings, slug) {
  const b = settings.business || {}, col = settings.colors || {};
  const name = b.name || slug;
  return {
    name, slug,
    description: b.tagline || (settings.mode === 'shop' ? 'Commandez en ligne et recevez votre commande. Paiement à la livraison.' : 'Commandez en quelques clics et envoyez votre commande sur WhatsApp.'),
    image: isUrl(b.cover) ? b.cover : isUrl(b.logo) ? b.logo : '',
    icon: isUrl(b.logo) ? b.logo : '',
    color: /^#[0-9a-f]{3,8}$/i.test(col.primary || '') ? col.primary : '#d62828',
    bg: settings.theme === 'dark' ? '#121212' : '#ffffff'
  };
}

export function brandHtml(html, info, pageUrl) {
  const tags = [
    `<title>${esc(info.name)}</title>`,
    `<meta name="description" content="${esc(info.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(info.name)}">`,
    `<meta property="og:description" content="${esc(info.description)}">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    info.image ? `<meta property="og:image" content="${esc(info.image)}">` : '',
    `<meta name="twitter:card" content="${info.image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="theme-color" content="${esc(info.color)}">`,
    info.icon ? `<link rel="icon" href="${esc(info.icon)}">` : '',
    info.icon ? `<link rel="apple-touch-icon" href="${esc(info.icon)}">` : '',
    `<link rel="manifest" href="/manifest.webmanifest?shop=${encodeURIComponent(info.slug)}">`
  ].filter(Boolean).join('\n');
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+(name="description"|property="og:title"|name="theme-color")[^>]*>\s*/gi, '')
    .replace(/<head>/i, '<head>\n' + tags);
}

export function manifest(info) {
  return {
    name: info.name, short_name: info.name.slice(0, 24), start_url: '/' + info.slug, scope: '/',
    display: 'standalone', background_color: info.bg, theme_color: info.color,
    icons: info.icon ? [{ src: info.icon, sizes: 'any', purpose: 'any' }] : []
  };
}
