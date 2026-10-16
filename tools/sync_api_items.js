#!/usr/bin/env node
/**
 * sync_api_items.js — met à jour le snapshot des items de l'API SAO utilisé par l'onglet "API" de la modération.
 *
 *   1. récupère tous les items sur api.saominecraft.com
 *   2. télécharge les nouvelles images (+ fallback resource pack local si présent)
 *   3. écrit repo/data/api-items.json  (items bruts + version convertie au format wiki)
 *
 * Usage:  node repo/tools/sync_api_items.js [--no-images]
 *
 * Le snapshot est un fichier statique : le navigateur ne peut pas appeler l'API directement (pas de CORS).
 * Il est rafraîchi par la GitHub Action .github/workflows/sync-api-items.yml, ou à la main avec cette commande.
 * Ne touche jamais Firestore.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { norm, convert, API_HOST } = require('./lib/convert');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const REPO = path.resolve(arg('--repo', path.join(__dirname, '..')));
const IMG_DIR = path.join(REPO, 'img', 'compendium', 'textures', 'api');
const OUT = path.join(REPO, 'data', 'api-items.json');
const RAW = path.join(__dirname, 'items.json');
const PER_PAGE = 50;

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (i >= tries) throw new Error(`${url} : ${e.message}`); await new Promise(r => setTimeout(r, 1000 * i)); }
  }
}

async function fetchAll() {
  const url = p => `${API_HOST}/api/items?page=${p}&perPage=${PER_PAGE}&sortBy=name`;
  const first = await getJson(url(1));
  const pages = first.data.totalPages;
  const items = [...first.data.items];
  for (let p = 2; p <= pages; p++) items.push(...(await getJson(url(p))).data.items);
  return items;
}

(async () => {
  const items = await fetchAll();
  if (items.length < 100) throw new Error(`Seulement ${items.length} items reçus — API anormale, abandon (snapshot conservé).`);
  console.log(`API: ${items.length} items`);
  fs.writeFileSync(RAW, JSON.stringify(items, null, 2), 'utf8');

  if (!args.includes('--no-images')) {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'fetch_images.js'), '--api', RAW, '--out', IMG_DIR], { stdio: 'inherit' });
    if (r.status !== 0) console.warn('fetch_images.js a échoué — snapshot construit sans nouvelles images');
  }
  const imgIndex = fs.existsSync(path.join(IMG_DIR, '_index.json')) ? JSON.parse(fs.readFileSync(path.join(IMG_DIR, '_index.json'), 'utf8')) : {};

  // doublons internes : même nom normalisé + même catégorie wiki + mêmes classes + même niveau (ex. apostrophe typographique)
  const groups = new Map();
  const conv = new Map();
  for (const x of items) {
    const c = convert(x);
    conv.set(x.id, c);
    const k = [norm(x.name), c.doc.category, (c.doc.classes || []).join(','), x.level].join('|');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  }
  const dupOf = new Map();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)) || b.id - a.id);
    g.slice(1).forEach(d => dupOf.set(d.id, g[0].id));
  }

  const out = items.map(x => {
    const { doc, flags } = conv.get(x.id);
    const img = imgIndex[x.id];
    if (img) doc.images = [`../img/compendium/textures/api/${img.file}`];
    return {
      api: x,
      wiki: doc,
      flags,
      image: img ? `img/compendium/textures/api/${img.file}` : null,
      imageSource: img ? img.source : null,
      dupOf: dupOf.get(x.id) || null,
    };
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const prevIds = new Set((prev?.items || []).map(i => i.api.id));
  const added = out.filter(i => !prevIds.has(i.api.id)).length;
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), count: out.length, items: out }), 'utf8');
  console.log(`Snapshot: ${out.length} items (${added} nouveaux depuis le précédent) -> ${path.relative(process.cwd(), OUT)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
