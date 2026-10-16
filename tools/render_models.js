#!/usr/bin/env node
/**
 * render_models.js — petit serveur local pour rendre en icônes les items dont le modèle est en 3D.
 *
 * Pourquoi : pour ces items, la "texture" du resource pack est un atlas UV (peau du modèle), illisible comme icône.
 * Il faut rendre le modèle. Le rendu est fait par tools/render-models.html (three.js) dans un navigateur ;
 * ce serveur lui fournit les modèles/textures du pack et enregistre les PNG.
 *
 * Usage :
 *   node repo/tools/render_models.js           (serveur sur :8124)
 *   puis ouvrir  http://localhost:8123/tools/render-models.html   (serveur statique du wiki)
 *
 * Écrit uniquement dans repo/img/compendium/textures/api/ (+ _index.json). Local uniquement (127.0.0.1).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { modelFor, loadModel, findFile, split, index, indexFile, OUT, roots, byUpload } = require('./fetch_images.js');

const PORT = 8124;
const api = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8').replace(/^﻿/, ''));

// modèle aplati : textures fusionnées avec les parents, éléments du plus proche ancêtre qui en a
function flatten(ref, depth = 0) {
  const m = loadModel(ref);
  if (!m) return null;
  const out = { textures: { ...(m.textures || {}) }, elements: m.elements, display: m.display };
  if (m.parent && depth < 8 && !/^(minecraft:)?(builtin\/|item\/generated|item\/handheld)/.test(m.parent)) {
    const p = flatten(m.parent, depth + 1);
    if (p) {
      out.textures = { ...p.textures, ...out.textures };
      out.elements = out.elements || p.elements;
      out.display = { ...(p.display || {}), ...(out.display || {}) };
    }
  }
  return out;
}

// Index inverse texture -> modèles 3D qui l'utilisent. Sert quand (matériau, cmd) ne donne rien dans le pack
// (cmd absent) mais que l'image de l'API est un atlas : on retrouve le modèle qui porte cette texture.
let texToModel = null;
function buildTexIndex() {
  texToModel = new Map();
  for (const r of roots) {
    const assets = path.join(r, 'assets');
    if (!fs.existsSync(assets)) continue;
    for (const ns of fs.readdirSync(assets)) {
      const mdir = path.join(assets, ns, 'models');
      if (!fs.existsSync(mdir)) continue;
      const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.json')) continue;
        let m; try { m = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
        if (!m.elements || !m.elements.length) continue;
        const ref = ns + ':' + path.relative(mdir, p).replace(/\\/g, '/').replace(/\.json$/, '');
        for (const t of Object.values(m.textures || {})) {
          const k = String(t).includes(':') ? String(t) : 'minecraft:' + t;
          if (!texToModel.has(k)) texToModel.set(k, []);
          if (!texToModel.get(k).includes(ref)) texToModel.get(k).push(ref);
        }
      } };
      walk(mdir);
    }
  }
}
function modelByTexture(x) {
  const png = byUpload(x);
  if (!png) return null;
  const m = png.replace(/\\/g, '/').match(/assets\/([^/]+)\/textures\/(.+)\.png$/);
  if (!m) return null;
  if (!texToModel) buildTexIndex();
  const refs = texToModel.get(m[1] + ':' + m[2]) || [];
  if (!refs.length) return null;
  if (refs.length === 1) return flatten(refs[0]);
  // atlas partagé par plusieurs modèles (ex. un set complet) : on départage par le nom de l'item
  // et son type d'arme ; si rien ne se détache nettement, on ne rend RIEN plutôt qu'une mauvaise arme.
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const KIND = { crossbow: ['crossbow', 'arbalet'], bow: ['bow', 'arc'], sword: ['sword', 'epee'], dagger: ['dagger', 'dague'],
    staff_mage: ['staff', 'baton'], staff_shaman: ['staff', 'baton'], shield: ['shield', 'bouclier'], armor: ['helmet', 'chest', 'boots', 'leggings', 'casque'],
    tool: ['pickaxe', 'axe', 'hoe', 'shovel', 'scythe', 'serpe'], catalyst: ['catalyst', 'catalyseur'] };
  const words = norm(x.name).split(/[^a-z0-9]+/).filter(w => w.length > 3);
  const kinds = KIND[x.category] || [];
  // mot du nom -> morceau du nom de modèle (le nom de l'item est le meilleur indice : « Serpe » = scythe)
  const NAME_HINT = { serpe: 'scythe', faux: 'scythe', hache: 'axe', pioche: 'pickaxe', houe: 'hoe', pelle: 'shovel', marteau: 'hammer',
    masse: 'mace', cle: 'key', canne: 'fishing_rod', plastron: 'chest', arbalete: 'crossbow', arc: 'bow' };
  const hints = norm(x.name).split(/[^a-z0-9]+/).map(w => NAME_HINT[w]).filter(Boolean);
  const scored = refs.map(r => {
    const t = norm(r), file = t.split('/').pop().replace(/\.json$/, '').split(':').pop();
    return { r, s: hints.filter(h => file === h).length * 6 + hints.filter(h => t.includes(h)).length * 3
      + words.filter(w => t.includes(w)).length * 2 + kinds.filter(k => t.includes(k)).length };
  }).sort((a, b) => b.s - a.s || a.r.length - b.r.length);   // à égalité : le nom le plus court (« crossbow » avant « crossbow_0 »)
  if (scored[0].s > 0 && (scored.length === 1 || scored[0].s > scored[1].s || scored[0].r.length < scored[1].r.length)) return flatten(scored[0].r);
  return null;
}

function modelOf(x) {
  let f = null;
  if (x.mmo_material && x.mmo_cmd != null) {
    const ref = modelFor(x.mmo_material, x.mmo_cmd);
    f = ref && flatten(ref);
  }
  if (!(f && f.elements && f.elements.length)) f = modelByTexture(x);
  return f && f.elements && f.elements.length ? f : null;
}

const toRender = () => api.filter(x => {
  const i = index[x.id];
  return (!i || i.source !== 'pack-3d') && modelOf(x);
}).map(x => ({ id: x.id, name: x.name }));

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
  res.end(body);
};

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const u = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(u.pathname);

  if (p === '/list') return send(res, 200, JSON.stringify(toRender()));

  let m;
  if ((m = p.match(/^\/model\/(\d+)$/))) {
    const x = api.find(i => i.id === Number(m[1]));
    const f = x && modelOf(x);
    if (!f) return send(res, 404, '{}');
    // textures : "ns:path" -> URL servie par ce serveur
    const tex = {};
    for (const [k, v] of Object.entries(f.textures)) tex[k] = String(v).startsWith('#') ? v : `http://localhost:${PORT}/tex/${String(v).includes(':') ? String(v).replace(':', '/') : 'minecraft/' + v}.png`;
    return send(res, 200, JSON.stringify({ ...f, textures: tex }));
  }

  if ((m = p.match(/^\/tex\/([^/]+)\/(.+)\.png$/))) {
    if (m[2].includes('..')) return send(res, 400, '');
    const f = findFile(`assets/${m[1]}/textures/${m[2]}.png`);
    return f ? send(res, 200, fs.readFileSync(f), 'image/png') : send(res, 404, '');
  }

  if (req.method === 'POST' && (m = p.match(/^\/save\/(\d+)$/))) {
    const id = Number(m[1]);
    if (!api.some(i => i.id === id)) return send(res, 404, '');
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.from(Buffer.concat(chunks).toString().replace(/^data:image\/png;base64,/, ''), 'base64');
      if (buf.length < 100 || buf.slice(1, 4).toString() !== 'PNG') return send(res, 400, 'png invalide');
      fs.writeFileSync(path.join(OUT, `${id}.png`), buf);
      index[id] = { file: `${id}.png`, source: 'pack-3d' };
      fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
      send(res, 200, '{"ok":true}');
    });
    return;
  }
  send(res, 404, '');
}).listen(PORT, '127.0.0.1', () => console.log(`render_models: http://127.0.0.1:${PORT}  (${toRender().length} items à rendre)`));
