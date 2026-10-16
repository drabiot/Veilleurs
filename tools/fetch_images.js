#!/usr/bin/env node
/**
 * fetch_images.js — récupère les images des items de l'API SAO.
 *
 * 1) Télécharge image_url depuis api.saominecraft.com (source officielle).
 * 2) Pour les items sans image_url, tente de retrouver la texture dans le resource pack local
 *    (ItemsAdder) via (mmo_material, mmo_cmd) -> modèle -> texture.
 *
 * Usage:
 *   node repo/tools/fetch_images.js                       (tout)
 *   node repo/tools/fetch_images.js --no-pack             (API seulement)
 *   node repo/tools/fetch_images.js --pack "<dossier sao>" --out repo/img/compendium/textures/api
 *
 * Sortie: <out>/<apiId>.png  +  <out>/_index.json  { apiId: { file, source } }
 * Ne modifie rien d'autre. Relançable (les fichiers existants sont conservés).
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const API_FILE = arg('--api', path.join(__dirname, 'items.json'));
const OUT = arg('--out', path.join(__dirname, '..', 'img', 'compendium', 'textures', 'api'));
const PACK = arg('--pack', path.join(process.env.APPDATA || '', '.Triggers Client', 'instances', 'Sword Art Online', 'resourcepacks', 'sao'));
const USE_PACK = !args.includes('--no-pack');
const HOST = 'https://api.saominecraft.com';

const api = JSON.parse(fs.readFileSync(API_FILE, 'utf8').replace(/^﻿/, ''));
fs.mkdirSync(OUT, { recursive: true });
const indexFile = path.join(OUT, '_index.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};

// ─── 1. API ──────────────────────────────────────────────────────────────────
async function download(x) {
  const file = path.join(OUT, `${x.id}.png`);
  if (fs.existsSync(file)) { index[x.id] = index[x.id] || { file: `${x.id}.png`, source: 'api' }; return 'skip'; }
  try {
    const r = await fetch(HOST + x.image_url + (x.image_url.includes('?') ? '' : '?v=2'));
    if (!r.ok) return `http ${r.status}`;
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    index[x.id] = { file: `${x.id}.png`, source: 'api', url: x.image_url };
    return 'ok';
  } catch (e) { return 'err ' + e.message; }
}

async function pool(items, n, fn) {
  const res = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]); } }));
  return res;
}

// ─── 2. Resource pack ────────────────────────────────────────────────────────
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const overlays = fs.existsSync(PACK) ? fs.readdirSync(PACK).filter(d => d.startsWith('ia_overlay')).sort().reverse() : [];
const roots = [PACK, ...overlays.map(o => path.join(PACK, o))];
const findFile = rel => { for (const r of roots) { const f = path.join(r, rel); if (fs.existsSync(f)) return f; } return null; };
const split = ref => { ref = String(ref).replace(/^#/, ''); const i = ref.indexOf(':'); return i < 0 ? ['minecraft', ref] : [ref.slice(0, i), ref.slice(i + 1)]; };

const modelCache = new Map();
const loadModel = ref => {
  if (modelCache.has(ref)) return modelCache.get(ref);
  const [ns, p] = split(ref);
  const f = findFile(`assets/${ns}/models/${p}.json`);
  const m = f ? readJson(f) : null;
  modelCache.set(ref, m);
  return m;
};

// texture de premier plan d'un modèle (suit parent + variables #)
function textureOf(ref, depth = 0) {
  if (depth > 6) return null;
  const m = loadModel(ref);
  if (!m) return null;
  let tex = m.textures || {};
  const resolve = v => { let g = 0; while (typeof v === 'string' && v.startsWith('#') && g++ < 6) v = tex[v.slice(1)]; return v; };
  for (const key of ['layer0', 'all', 'particle', ...Object.keys(tex)]) {
    const t = resolve(tex[key]);
    if (t && !String(t).startsWith('#')) return t;
  }
  if (m.parent && !/^(minecraft:)?(item|builtin|block)\/(generated|handheld|entity|cube|block)/.test(m.parent)) return textureOf(m.parent, depth + 1);
  return null;
}

// (material, cmd) -> ref modèle, via models/item/<material>.json (overrides) puis items/<material>.json (range_dispatch)
const defCache = new Map();
function modelFor(material, cmd) {
  if (defCache.has(material) === false) {
    const legacy = readJson(findFile(`assets/minecraft/models/item/${material}.json`) || '');
    const modern = [...roots].reverse().map(r => readJson(path.join(r, `assets/minecraft/items/${material}.json`))).filter(Boolean).pop();
    defCache.set(material, { legacy, modern });
  }
  const { legacy, modern } = defCache.get(material);
  if (legacy && legacy.overrides) {
    const o = legacy.overrides.find(o => o.predicate && o.predicate.custom_model_data === cmd);
    if (o) return o.model;
  }
  const walk = n => {
    if (!n) return null;
    if (n.type && /range_dispatch/.test(n.type) && n.property === 'custom_model_data') {
      const e = (n.entries || []).filter(e => e.threshold <= cmd).sort((a, b) => b.threshold - a.threshold)[0];
      if (e && e.threshold === cmd) return e.model.model || walk(e.model);
    }
    return null;
  };
  return modern ? walk(modern.model) : null;
}

// index (namespace/basename) des PNG du pack, pour retrouver /uploads/items/<ns>/<nom>.png
let pngIndex = null;
function byUpload(x) {
  if (!x.image_url) return null;
  if (!pngIndex) {
    pngIndex = new Map();
    const walkDir = (d, ns) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkDir(p, ns); else if (e.name.endsWith('.png')) { const k = ns + '/' + e.name; if (!pngIndex.has(k)) pngIndex.set(k, p); } } };
    for (const r of roots) { const a = path.join(r, 'assets'); if (!fs.existsSync(a)) continue;
      for (const ns of fs.readdirSync(a)) walkDir(path.join(a, ns), ns); }
  }
  const parts = x.image_url.split('/'); // '', uploads, items, <ns>, <file>
  return pngIndex.get(parts[3] + '/' + parts[parts.length - 1]) || null;
}

function packImage(x) {
  const up = byUpload(x);
  if (up) return up;
  if (!x.mmo_material || x.mmo_cmd == null) return null;
  const ref = modelFor(x.mmo_material, x.mmo_cmd);
  if (!ref) return null;
  const tex = textureOf(ref);
  if (!tex) return null;
  const [ns, p] = split(tex);
  return findFile(`assets/${ns}/textures/${p}.png`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const withUrl = api.filter(x => x.image_url);
  const r = await pool(withUrl, 8, download);
  const stat = r.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
  console.log('API images:', stat);

  let packOk = 0, packFail = 0; const failed = [];
  if (USE_PACK) {
    if (!fs.existsSync(PACK)) console.warn('Resource pack introuvable:', PACK);
    else for (const x of api.filter(x => !index[x.id])) {
      const src = packImage(x);
      if (src) { fs.copyFileSync(src, path.join(OUT, `${x.id}.png`)); index[x.id] = { file: `${x.id}.png`, source: 'pack', pack: path.relative(PACK, src).replace(/\\/g, '/') }; packOk++; }
      else { packFail++; failed.push({ id: x.id, name: x.name, material: x.mmo_material, cmd: x.mmo_cmd }); }
    }
    console.log(`Resource pack: ${packOk} trouvées, ${packFail} introuvables`);
  }
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
  fs.writeFileSync(path.join(OUT, '_missing.json'), JSON.stringify(failed, null, 1));
  console.log(`Index: ${Object.keys(index).length} / ${api.length} items avec image -> ${OUT}`);
}

if (require.main === module) main();
module.exports = { modelFor, loadModel, findFile, split, textureOf, packImage, byUpload, roots, index, indexFile, OUT, PACK };
