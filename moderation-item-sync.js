// ══════════════════════════════════════════════════════
// SYNCHRO DES RÉFÉRENCES D'ITEMS — obtain PNJ/mobs ↔ items, renommage d'ID
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { invalidateModCache, _regionName, db, collection, getDocs, getDoc, doc, updateDoc, setDoc, toast, cachedDocs, escHtml } = ctx;
// ── Obtention écrite dans l'item : quand un PNJ fabrique ou vend un item, la ligne « Fabricable au [PNJ] » / « Achetable au [PNJ] » est ajoutée
// au champ `obtain` de cet item (sans doublon). Si le PNJ ne fabrique / ne vend plus l'item, sa ligne est retirée. Les autres lignes ne sont jamais touchées.
async function _syncPnjObtain(pnj) {
  const pid = pnj && (pnj.id || pnj._id);
  if (!pid || !pnj.name) return [];
  const want = new Map(); // id d'item -> ligne
  for (const e of (pnj.craft || [])) if (e && e.id) want.set(e.id, `Fabricable au [npc:${pid}|${pnj.name}]${npcLocSuffix(pnj, pnj.region ? _regionName(pnj.region) : '')}`);
  for (const e of (pnj.sells || [])) if (e && e.id && !want.has(e.id)) want.set(e.id, `Achetable au [npc:${pid}|${pnj.name}]${npcLocSuffix(pnj, pnj.region ? _regionName(pnj.region) : '')}`);
  const esc = String(pid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mine = new RegExp('^[\\s-]*(Fabricable|Achetable) au \\[npc:' + esc + '[|\\]].*$', 'i');
  const snap = await getDocs(collection(db, 'items'));
  const touched = [];
  for (const d of snap.docs) {
    const data = d.data();
    const lines = String(data.obtain || '').split('\n');
    const kept = lines.filter(l => !mine.test(l.trim()));
    const line = want.get(d.id);
    const had = kept.length !== lines.length;
    if (!line && !had) continue;                       // l'item n'a rien à voir avec ce PNJ
    const text = line ? [...kept.filter(l => l.trim() !== ''), line].join('\n') : kept.join('\n').trim();
    if (text === String(data.obtain || '')) continue;
    await updateDoc(d.ref, { obtain: text });
    touched.push(data.name || d.id);
  }
  if (touched.length) invalidateModCache('items');
  return touched;
}

// Sens inverse : à la création / modification d'un item, les PNJ qui le fabriquent ou le vendent déjà y ajoutent leur ligne d'obtention.
// ── Loot des mobs ↔ obtain des items : la ligne « - [mob|Nom][chance] » du bloc « Obtenable en tuant: » suit le loot du mob (le mob fait foi).
const _mobLineRe = mid => new RegExp('^\\s*-\\s*\\[' + String(mid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\|[^\\]]*\\]\\[[^\\]]*\\]\\s*$');
function _upsertMobLine(text, mid, name, chance) {
  const line = `- [${mid}|${name || mid}][${chance != null && chance !== '' ? chance : '?'}]`;
  const lines = String(text || '').split('\n');
  const re = _mobLineRe(mid);
  const at = lines.findIndex(l => re.test(l));
  if (at >= 0) { lines[at] = line; return lines.join('\n'); }
  let last = -1, inBlock = false;
  lines.forEach((l, i) => {
    if (/^\s*Obtenable en tuant/i.test(l)) { inBlock = true; last = i; }
    else if (inBlock && /^\s*-\s*\[[^|\]]+\|[^\]]*\]\[[^\]]*\]\s*$/.test(l)) last = i;
    else if (l.trim() && !/^\s*-/.test(l)) inBlock = false;
  });
  if (last >= 0) { lines.splice(last + 1, 0, line); return lines.join('\n'); }
  const base = lines.filter(l => l.trim() !== '');
  return [...base, 'Obtenable en tuant:', line].join('\n');
}
function _removeMobLine(text, mid) {
  const re = _mobLineRe(mid);
  let lines = String(text || '').split('\n').filter(l => !re.test(l));
  // un bloc « Obtenable en tuant: » devenu vide disparaît aussi
  lines = lines.filter((l, i) => !(/^\s*Obtenable en tuant/i.test(l) && !/^\s*-\s*\[/.test(lines[i + 1] || '')));
  return lines.join('\n').trim();
}
// Mob créé / modifié : chaque item de son loot reçoit (ou met à jour) sa ligne ; un item qu'il ne loot plus la perd.
async function _syncMobObtain(mob) {
  const mid = mob && (mob.id || mob._id);
  if (!mid) return [];
  const lootMap = new Map();
  for (const l of (Array.isArray(mob.loot) ? mob.loot : [])) if (l && l.id) lootMap.set(l.id, l.chance);
  const snap = await getDocs(collection(db, 'items'));
  const touched = [];
  for (const d of snap.docs) {
    const data = d.data(), cur = String(data.obtain || '');
    const has = _mobLineRe(mid);
    const hadLine = cur.split('\n').some(l => has.test(l));
    let next = cur;
    if (lootMap.has(d.id)) next = _upsertMobLine(cur, mid, mob.name, lootMap.get(d.id));
    else if (hadLine) next = _removeMobLine(cur, mid);
    else continue;
    if (next === cur) continue;
    await updateDoc(d.ref, { obtain: next });
    touched.push(data.name || d.id);
  }
  if (touched.length) invalidateModCache('items');
  return touched;
}

async function _syncItemObtain(itemId) {
  if (!itemId) return [];
  const ref = doc(db, 'items', String(itemId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const cur = String(snap.data().obtain || '');
  const lst = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  const pnjs = await getDocs(collection(db, 'personnages'));
  let lines = cur.split('\n');
  for (const d of pnjs.docs) {
    const p = d.data(), pid = p.id || d.id;
    if (!p.name) continue;
    const crafts = lst(p.craft).some(e => e && e.id === itemId);
    const sells = lst(p.sells).some(e => e && e.id === itemId);
    if (!crafts && !sells) continue;
    const loc = npcLocSuffix(p, p.region ? _regionName(p.region) : '');
    const line = `${crafts ? 'Fabricable' : 'Achetable'} au [npc:${pid}|${p.name}]${loc}`;
    const esc = String(pid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mine = new RegExp('^[\\s-]*(Fabricable|Achetable) au \\[npc:' + esc + '[|\\]].*$', 'i');
    lines = lines.filter(l => !mine.test(l.trim()));
    lines = lines.filter(l => l.trim() !== '').concat(line);
  }
  let text = lines.join('\n');
  try {
    const mobsSnap = await getDocs(collection(db, 'mobs'));
    for (const d of mobsSnap.docs) {
      const m = d.data(), l = (Array.isArray(m.loot) ? m.loot : []).find(x => x && x.id === itemId);
      if (l) text = _upsertMobLine(text, m.id || d.id, m.name, l.chance);
    }
  } catch (e) { console.warn('[obtain mobs]', e); }
  if (text === cur) return [];
  await updateDoc(ref, { obtain: text });
  invalidateModCache('items');
  return [snap.data().name || String(itemId)];
}

// Registre des renommages (config/item_renames : { map: { ancienId: nouvelId } }). Les navigateurs qui ont encore l'ancien ID
// dans un brouillon d'Atelier le convertissent au chargement. Les chaînes sont raccourcies (a→b puis b→c devient a→c).
async function _recordItemRename(oldId, newId) {
  try {
    const ref = doc(db, 'config', 'item_renames');
    const snap = await getDoc(ref);
    const map = snap.exists() ? { ...(snap.data().map || {}) } : {};
    for (const k of Object.keys(map)) if (map[k] === oldId) map[k] = newId;
    map[oldId] = newId;
    delete map[newId];
    await setDoc(ref, { map });
  } catch (e) { console.warn('[renommage] registre non mis à jour :', e); }
}

async function _renameItemReferences(oldId, newId, opts = {}) {
  const COLS = ['items', 'mobs', 'personnages', 'quetes', 'panoplies', 'regions', 'zones', 'donjons', 'map_markers', 'builds_published', 'submissions', 'config'];
  const deepRep = v => {
    if (v === oldId) return { v: newId, c: true };
    if (opts.npcText && typeof v === 'string' && (v.includes(`[npc:${oldId}|`) || v.includes(`[npc:${oldId}]`))) {
      return { v: v.split(`[npc:${oldId}|`).join(`[npc:${newId}|`).split(`[npc:${oldId}]`).join(`[npc:${newId}]`), c: true };
    }
    if (Array.isArray(v)) { let c = false; const o = v.map(x => { const r = deepRep(x); if (r.c) c = true; return r.v; }); return { v: o, c }; }
    if (v && typeof v === 'object' && typeof v.toMillis !== 'function') {
      let c = false; const o = {};
      for (const [k, x] of Object.entries(v)) { const r = deepRep(x); if (r.c) c = true; o[k] = r.v; }
      return { v: o, c };
    }
    return { v, c: false };
  };
  let touched = 0;
  for (const col of COLS) {
    const snap = await getDocs(collection(db, col));
    for (const d of snap.docs) {
      if ((col === 'items' || col === 'personnages') && (d.id === oldId || d.id === newId)) continue;
      const data = d.data();
      if (col === 'submissions' && data.status !== 'pending') continue; // l'historique des soumissions traitées reste tel quel
      const patch = {};
      for (const [k, v] of Object.entries(data)) {
        if (k.startsWith('_')) continue;
        const r = deepRep(v);
        if (r.c) patch[k] = r.v;
      }
      if (Object.keys(patch).length) { await updateDoc(d.ref, patch); touched++; }
    }
    invalidateModCache(col);
  }
  return touched;
}

// Appelés par les panneaux Soumissions et Éditeur (via window, le module étant chargé à la demande)
Object.assign(window, { _syncPnjObtain, _syncMobObtain, _syncItemObtain, _recordItemRename, _renameItemReferences });
}
