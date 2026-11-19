#!/usr/bin/env node
/* Turn a static config.js (e.g. a demo) into SQL that fills a Supabase shop.
   Usage:  node tools/config-to-sql.js demos/bahia-pizza/config.js bahia-pizza > seed.sql
   Then paste seed.sql in Supabase → SQL Editor (the shop must exist: create_shop first). */
const fs = require('fs'), crypto = require('crypto');

function readConfig(file) { const w = {}; new Function('window', fs.readFileSync(file, 'utf8'))(w); return w.CONFIG; }

// static config → { settings, categories[], items[] } rows (ids are fresh UUIDs)
function toRows(cfg, shop) {
  const settings = {};
  for (const k of Object.keys(cfg)) if (!['items', 'categories', 'id', 'demo', 'supabase', 'shop'].includes(k)) settings[k] = cfg[k];
  const catIds = {};
  const categories = (cfg.categories || []).map((c, i) => {
    catIds[c.id] = crypto.randomUUID();
    return { id: catIds[c.id], shop_id: shop, name: c.name, name_ar: c.name_ar || null, icon: c.icon || null, position: i };
  });
  const items = (cfg.items || []).map((it, i) => ({
    id: crypto.randomUUID(), shop_id: shop, category_id: catIds[it.cat] || null,
    name: it.name, name_ar: it.name_ar || null, description: it.desc || null, description_ar: it.desc_ar || null,
    price: it.price || 0, photo: it.img || null, emoji: it.emoji || null, variants: it.variants || [],
    available: !it.soldOut, popular: !!it.popular, hidden: !!it.hidden, position: i
  }));
  return { settings, categories, items };
}

function lit(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function toSql(rows, shop) {
  const out = [`-- seed for shop "${shop}" (replaces its categories and items)`, 'begin;',
    `update public.shops set settings = ${lit(rows.settings)} where id = ${lit(shop)};`,
    `delete from public.items where shop_id = ${lit(shop)};`,
    `delete from public.categories where shop_id = ${lit(shop)};`];
  for (const c of rows.categories) out.push(`insert into public.categories (id, shop_id, name, name_ar, icon, position) values (${[c.id, c.shop_id, c.name, c.name_ar, c.icon, c.position].map(lit).join(', ')});`);
  for (const i of rows.items) out.push(`insert into public.items (id, shop_id, category_id, name, name_ar, description, description_ar, price, photo, emoji, variants, available, popular, hidden, position) values (${[i.id, i.shop_id, i.category_id, i.name, i.name_ar, i.description, i.description_ar, i.price, i.photo, i.emoji, i.variants, i.available, i.popular, i.hidden, i.position].map(lit).join(', ')});`);
  out.push('commit;');
  return out.join('\n') + '\n';
}

module.exports = { readConfig, toRows, toSql };
if (require.main === module) {
  const [file, shop] = process.argv.slice(2);
  if (!file || !shop) { console.error('Usage: node tools/config-to-sql.js <config.js> <shop-id>'); process.exit(1); }
  process.stdout.write(toSql(toRows(readConfig(file), shop), shop));
}
