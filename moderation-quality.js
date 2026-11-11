// ══════════════════════════════════════════════════════
// QUALITÉ DES DONNÉES — Chasse au Clair de Lune (complétion), champs requis du Creator, images cassées
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { cachedDocs, invalidateModCache, escHtml, _SUB_COL_MAP, setHash: _setHash, showPanel: _showPanel, db, hasRole, COL, getDoc, doc, updateDoc, setDoc, toast, modal, collection, getDocs, deleteDoc } = ctx;
const _dqSort = p => window._dqSort?.(p) ?? 'default', _dqRank = p => window._dqRank?.(p) ?? 3000;
// ── Completion panel ───────────────────────────────────

// Définitions des champs pour les inputs guidés
// Clé = fieldId, ou "mode:fieldId" pour une surcharge par mode
const _CF_DEFS = {
  palier:      { type:'select',    get opts() { return ctx.paliersOpts ?? [[1,'Palier 1'],[2,'Palier 2'],[3,'Palier 3'],['event','Event'],[-1,'Palier Archive']]; } },
  difficulty:  { type:'number',    min:1, max:5, placeholder:'1–5' },
  lvl:         { type:'number',    min:1, placeholder:'Niveau requis' },
  lore:        { type:'textarea',  placeholder:'Texte de lore…' },
  obtain:      { type:'textarea',  placeholder:"Description de l'obtention…" },
  desc:        { type:'textarea',  placeholder:'Description…' },
  objectifs:   { type:'textarea',  placeholder:'Objectifs (un par ligne)' },
  recompenses: { type:'textarea',  placeholder:'Récompenses' },
  name:        { type:'text',      placeholder:'Nom affiché' },
  label:       { type:'text',      placeholder:'Nom affiché' },
  titre:       { type:'text',      placeholder:'Titre' },
  images:      { type:'text',      placeholder:'URL image (https://…)' },
  color:       { type:'colortext', placeholder:'#a07ae8' },
  npc:         { type:'text',      placeholder:'ID ou nom du PNJ donneur' },
  zone:        { type:'text',      placeholder:'ID région' },
  // Surcharges par mode
  'items:event':     { type:'select', get opts() { return (typeof EVENT_NAMES !== 'undefined' ? EVENT_NAMES : []).map(n => [n, n]); } },
  'items:rarity':    { type:'select', opts:[['commun','Commun'],['rare','Rare'],['epique','Épique'],['legendaire','Légendaire'],['mythique','Mythique'],['godlike','Godlike'],['event','Évènement']] },
  'items:category':  { type:'select', opts:[['arme','⚔️ Arme'],['armure','🛡️ Armure'],['accessoire','💍 Accessoire'],['materiaux','🧱 Matériau'],['ressources','⛏️ Ressource'],['consommable','🧪 Consommable'],['nourriture','🍖 Nourriture'],['outils','🔧 Outil'],['rune','🔮 Rune'],['parchemin','📃 Parchemin'],['quete','📜 Objet Quête'],['donjon','🏰 Donjon']] },
  'items:classes':   { type:'multicheckbox', opts:[['guerrier','⚔️ Guerrier'],['assassin','🗡️ Assassin'],['archer','🏹 Archer'],['mage','📖 Mage'],['shaman','🌿 Shaman']] },
  'mobs:type':       { type:'select', opts:[['monstre','👹 Monstre'],['sbire','💀 Sbire'],['mini_boss','⚡ Mini-Boss'],['worldboss','🌍 WorldBoss'],['boss','🔥 Boss']] },
  'mobs:region':     { type:'dbselect', colName:'regions', labelKey:'name' },
  'quetes:type':     { type:'select', opts:[['main','⚔️ Principale'],['sec','🗺️ Secondaire'],['fu','📋 Fractured Underworld']] },
  'quetes:zone':     { type:'dbselect', colName:'regions', labelKey:'name' },
  'pnj:type':        { type:'select', opts:[['marchand','🛒 Marchand'],['donneur_quete','📜 Donneur quête'],['forgeron','⚒️ Forgeron'],['aubergiste','🍺 Aubergiste'],['instructeur','📚 Instructeur'],['autre','❓ Autre']] },
  'pnj:region':      { type:'dbselect', colName:'regions', labelKey:'name' },
  craft_cd:          { type:'text', placeholder:'ex: 24h, aucun' },
};

const _NUMERIC_CF_FIELDS = new Set(['palier','lvl','difficulty','rune_slots','ordre']);

// Construit un input guidé pour un champ manquant
function _buildCompletionInput(fieldId, mode, currentValue) {
  const def = _CF_DEFS[`${mode}:${fieldId}`] || _CF_DEFS[fieldId];
  const BASE_STYLE = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:13px;outline:none;';

  if (!def || def.type === 'text') {
    const el = document.createElement('input');
    el.type = 'text'; el.dataset.field = fieldId;
    el.placeholder = def?.placeholder || fieldId;
    el.style.cssText = BASE_STYLE;
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'number') {
    const el = document.createElement('input');
    el.type = 'number'; el.dataset.field = fieldId;
    if (def.min != null) el.min = def.min;
    if (def.max != null) el.max = def.max;
    el.placeholder = def.placeholder || fieldId;
    el.style.cssText = BASE_STYLE + 'width:80px;';
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'select') {
    const el = document.createElement('select');
    el.dataset.field = fieldId;
    el.style.cssText = BASE_STYLE + 'min-width:140px;cursor:pointer;';
    el.innerHTML = '<option value="">— choisir —</option>' +
      def.opts.map(([v, l]) =>
        `<option value="${escHtml(String(v))}"${String(v) === String(currentValue) ? ' selected' : ''}>${escHtml(l || String(v))}</option>`
      ).join('');
    return el;
  }

  if (def.type === 'textarea') {
    const el = document.createElement('textarea');
    el.dataset.field = fieldId;
    el.placeholder = def.placeholder || fieldId;
    el.rows = 3;
    el.style.cssText = BASE_STYLE + 'width:300px;max-width:100%;resize:vertical;font-family:inherit;font-size:12px;';
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'colortext') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.style.cssText = 'width:36px;height:32px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;flex-shrink:0;';
    const textEl = document.createElement('input');
    textEl.type = 'text'; textEl.dataset.field = fieldId;
    textEl.placeholder = def.placeholder || '#a07ae8';
    textEl.style.cssText = BASE_STYLE + 'width:120px;font-family:monospace;';
    if (currentValue) { textEl.value = currentValue; try { colorPicker.value = currentValue; } catch {} }
    colorPicker.addEventListener('input', () => { textEl.value = colorPicker.value; });
    textEl.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(textEl.value)) try { colorPicker.value = textEl.value; } catch {} });
    wrap.appendChild(colorPicker);
    wrap.appendChild(textEl);
    return wrap;
  }

  if (def.type === 'multicheckbox') {
    const wrap = document.createElement('div');
    wrap.dataset.field = fieldId;
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
    const current = Array.isArray(currentValue) ? currentValue : [];
    def.opts.forEach(([v, l]) => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:4px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;white-space:nowrap;';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = v; cb.checked = current.includes(v);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(l || v));
      wrap.appendChild(label);
    });
    return wrap;
  }

  if (def.type === 'dbselect') {
    const el = document.createElement('select');
    el.dataset.field = fieldId;
    el.style.cssText = BASE_STYLE + 'min-width:160px;cursor:pointer;';
    el.innerHTML = '<option value="">Chargement…</option>';
    cachedDocs(def.colName).then(docs => {
      docs = [...docs].sort((a, b) => (a[def.labelKey]||a.id||'').localeCompare(b[def.labelKey]||b.id||'', 'fr'));
      el.innerHTML = '<option value="">— choisir —</option>' +
        docs.map(d => `<option value="${escHtml(d.id||'')}"${d.id === String(currentValue||'') ? ' selected' : ''}>${escHtml(d[def.labelKey]||d.id||'')}</option>`).join('');
    }).catch(() => { el.innerHTML = '<option value="">Erreur</option>'; });
    return el;
  }

  // Fallback
  const el = document.createElement('input');
  el.type = 'text'; el.dataset.field = fieldId;
  el.placeholder = fieldId;
  el.style.cssText = BASE_STYLE;
  if (currentValue != null) el.value = currentValue;
  return el;
}

const REQUIRED_ADMIN_FIELDS = {
  mob:    ['difficulty'],
  region: ['color'],
};

let _completionResults = [];
let _tdcData = {};
let _completionIgnored = null;
let _subsByDoc = {}; // { [colName~docId]: submission } — dernière sub par doc // { [mode]: Set<string> } — null = non chargé

async function _loadCompletionIgnored() {
  if (_completionIgnored !== null) return;
  _completionIgnored = {};
  try {
    const snap = await getDoc(doc(db, 'config', 'completion_ignored'));
    if (snap.exists()) {
      for (const [mode, ids] of Object.entries(snap.data())) {
        _completionIgnored[mode] = new Set(Array.isArray(ids) ? ids : []);
      }
    }
  } catch {}
  for (const mode of Object.keys(QUALITY_COL_MAP)) {
    if (!_completionIgnored[mode]) _completionIgnored[mode] = new Set();
  }
}

async function _saveCompletionIgnored() {
  const payload = {};
  for (const [m, ids] of Object.entries(_completionIgnored || {})) {
    if (ids.size) payload[m] = [...ids];
  }
  await setDoc(doc(db, 'config', 'completion_ignored'), payload);
}

window.showCompletion = async () => {
  _setHash('completion');
  document.getElementById('completion-panel').style.display = '';
  document.getElementById('btn-completion').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadCompletion();
};

window.loadCompletion = async () => {
  const list = document.getElementById('completion-list');
  list.innerHTML = '<div class="empty">Chargement…</div>';
  _completionIgnored = null; // forcer rechargement
  await _loadCompletionIgnored();

  // Charger quality standards depuis Firestore
  let standards = {};
  try {
    const _normF = f => (f === 'img' || f === 'image') ? 'images' : f;
    const snap = await getDoc(doc(db, 'config', 'data_quality_standards'));
    if (snap.exists()) {
      for (const [mode, cfg] of Object.entries(snap.data())) {
        const normReq = [...new Set((cfg.required || []).map(_normF))];
        const normByCat = {};
        for (const [sc, scfg] of Object.entries(cfg.byCategory || {})) {
          normByCat[sc] = { required: [...new Set((scfg.required || []).map(_normF))] };
        }
        standards[mode] = { required: normReq, byCategory: normByCat };
      }
    }
  } catch {}

  // Fusionner les champs admin obligatoires (required_admin_fields ou fallback)
  let adminFields = REQUIRED_ADMIN_FIELDS;
  try {
    const snap = await getDoc(doc(db, 'config', 'required_admin_fields'));
    if (snap.exists()) adminFields = snap.data();
  } catch {}
  const _adminColMap = { mob:'mobs', quete:'quetes', region:'regions' };
  for (const [type, fields] of Object.entries(adminFields)) {
    const mode = _adminColMap[type] || type;
    if (!standards[mode]) standards[mode] = { required: [], byCategory: {} };
    for (const f of fields) {
      if (!standards[mode].required.includes(f)) standards[mode].required.push(f);
    }
  }

  if (!Object.keys(standards).length) {
    list.innerHTML = '<div class="empty">Aucune configuration définie. Définissez les champs requis dans ⚙️ Champs requis.</div>';
    const badge = document.getElementById('count-incomplete');
    if (badge) badge.style.display = 'none';
    return;
  }

  _completionResults = [];
  try {
    for (const [mode, std] of Object.entries(standards)) {
      const colName = QUALITY_COL_MAP[mode];
      if (!colName) continue;
      const disc    = QUALITY_DISCRIMINANT[mode];
      const hasByCat = disc && Object.keys(std.byCategory || {}).length > 0;
      let docs = [];
      try { docs = await cachedDocs(colName); } catch { continue; }
      for (const _d of docs) {
        const d = (!_d.images?.length && (_d.img || _d.image))
          ? { ..._d, images: [_d.img || _d.image].filter(Boolean) }
          : _d;
        const missing = (std.required || []).filter(f => _fieldEmpty(d, f));
        const discVal = disc ? (d[disc] || null) : null;
        if (hasByCat && !discVal) {
          if (!missing.includes(disc)) missing.push(disc);
        } else if (discVal && std.byCategory?.[discVal]) {
          for (const f of (std.byCategory[discVal].required || [])) {
            if (!missing.includes(f) && _fieldEmpty(d, f)) missing.push(f);
          }
        }
        if (missing.length) _completionResults.push({ mode, colName, doc: d, missing, discVal });
      }
    }
  } catch(e) {
    list.innerHTML = `<div class="empty">Erreur : ${e.message}</div>`;
    return;
  }

  // Quêtes sans description (vérification systématique, indépendante des standards)
  try {
    const questDocs = await cachedDocs('quetes');
    // Ajouter 'desc' aux quêtes déjà dans les résultats qui n'ont pas de description
    for (const r of _completionResults) {
      if (r.colName === 'quetes' && (!r.doc.desc || !r.doc.desc.trim())) {
        if (!r.missing.includes('desc')) r.missing.push('desc');
      }
    }
    const coveredQuestIds = new Set(_completionResults.filter(r => r.colName === 'quetes').map(r => r.doc.id || r.doc._id));
    for (const q of questDocs) {
      const qid = q.id || q._id;
      if (coveredQuestIds.has(qid)) continue;
      if (!q.desc || !q.desc.trim()) {
        _completionResults.push({ mode: 'quetes', colName: 'quetes', doc: q, missing: ['desc'], discVal: null });
      }
    }
  } catch {}

  // craft_cd — requis seulement si l'item a des ingrédients de craft
  try {
    const itemDocs = await cachedDocs(COL.items);
    for (const r of _completionResults) {
      if (r.colName === COL.items && Array.isArray(r.doc.craft) && r.doc.craft.length > 0
          && (!r.doc.craft_cd || !String(r.doc.craft_cd).trim())) {
        if (!r.missing.includes('craft_cd')) r.missing.push('craft_cd');
      }
    }
    const coveredItemIds = new Set(
      _completionResults.filter(r => r.colName === COL.items).map(r => r.doc.id || r.doc._id)
    );
    for (const item of itemDocs) {
      const iid = item.id || item._id;
      if (coveredItemIds.has(iid)) continue;
      if (Array.isArray(item.craft) && item.craft.length > 0
          && (!item.craft_cd || !String(item.craft_cd).trim())) {
        _completionResults.push({
          mode: 'items', colName: COL.items, doc: item,
          missing: ['craft_cd'], discVal: item.category || null,
        });
      }
    }
  } catch {}

  // Charger la sélection de la Chasse
  try {
    const tdcSnap = await getDoc(doc(db, 'config', 'tableau_de_chasse'));
    _tdcData = tdcSnap.exists() ? tdcSnap.data() : {};
  } catch { _tdcData = {}; }

  // Construire lookup soumissions par doc (depuis ctx.allSubs global)
  _subsByDoc = {};
  for (const sub of (window.allSubs || [])) {
    const colName = _SUB_COL_MAP[sub.type];
    const id = sub.data?.id;
    if (!colName || !id) continue;
    const key = colName + '~' + id;
    const existing = _subsByDoc[key];
    // Garder la plus récente (par submittedAt)
    if (!existing || (sub.submittedAt?.seconds || 0) > (existing.submittedAt?.seconds || 0)) {
      _subsByDoc[key] = sub;
    }
  }

  // Auto-retirer du TDC : items complets (plus dans _completionResults) OU submission approuvée
  const _incompleteKeys = new Set(_completionResults.map(r => r.mode + '~' + (r.doc.id || '')));
  let _tdcModified = false;
  const _closedAvis = []; // avis fermés tout seuls : leurs « infos » (tickets Chasse) sont supprimées
  for (const [mode, ids] of Object.entries(_tdcData)) {
    if (!Array.isArray(ids) || mode === 'avis') continue; // « avis » = liste d'objets gérée par la page Chasse
    const colName = QUALITY_COL_MAP[mode];
    const filtered = ids.filter(id => {
      if (!_incompleteKeys.has(mode + '~' + id)) return false; // plus de champs manquants
      const sub = _subsByDoc[colName + '~' + id];
      if (sub?.status === 'approved') return false; // submission acceptée
      return true;
    });
    if (filtered.length !== ids.length) {
      ids.filter(id => !filtered.includes(id)).forEach(id => _closedAvis.push({ mode, id }));
      _tdcData[mode] = filtered; _tdcModified = true;
    }
  }
  if (_tdcModified) {
    try { await setDoc(doc(db, 'config', 'tableau_de_chasse'), _tdcData); } catch {}
  }

  _closedAvis.push(...await _chLoadAvis());   // avis manuels : 🌑 fiche à créer / 🌘 à raviver
  await _chLoadInfos();
  await _chPurgeInfos(_closedAvis);
  _brokenCache = null;   // les images sont revérifiées à la demande
  renderCompletion();
};

// ══ CHASSE — gestion des avis ══════════════════════════
// Trois sortes d'avis (voir Chasse/chasse.js) : 🌓 champs manquants (ids cochés + champs recalculés),
// 🌑 fiche à créer et 🌘 à raviver (liste `avis` de config/tableau_de_chasse).
const _CH_KINDS = {
  fields: { moon: '🌓', label: 'Champs manquants' },
  create: { moon: '🌑', label: 'Fiche à créer' },
  update: { moon: '🌘', label: 'À raviver' },
};
const _CH_FIELD_LABELS = {
  name: 'Nom', titre: 'Titre', label: 'Nom', lore: 'Lore', desc: 'Description', images: 'Image', img: 'Image', image: 'Image',
  rarity: 'Rareté', category: 'Catégorie', palier: 'Palier', lvl: 'Niveau requis', obtain: 'Obtention', stats: 'Stats',
  effects: 'Effets', craft: 'Craft', craft_cd: 'Délai de craft', classes: 'Classes', event: 'Évènement', type: 'Type',
  region: 'Région', zone: 'Zone', coords: 'Coordonnées', difficulty: 'Difficulté', color: 'Couleur', npc: 'PNJ donneur',
  objectifs: 'Objectifs', recompenses: 'Récompenses', rune_slots: 'Emplacements de rune', ordre: 'Ordre', loot: 'Loot', bonuses: 'Bonus',
};
const _CH_TABS = [
  { id: 'board',   label: 'Sur le tableau' },
  { id: 'todo',    label: 'À lancer' },
  { id: 'ignored', label: 'Ignorés' },
  { id: 'images',  label: 'Images' },
];
const _ch = { tab: 'board', kind: '', mode: '', q: '', field: '', palier: '', sort: 'palier', open: new Set(), openInfo: new Set() };
let _avis = [];          // avis manuels encore actifs (🌑 / 🌘)
let _brokenCache = null; // résultat de la vérification des images

const _chNorm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const _chName = d => d.name || d.titre || d.label || d.id || '';
const _chPalKey = p => (p == null || p === '') ? '' : p === 'event' ? 'event' : (Number(p) < 0 ? '-1' : String(p));
const _chRank = p => { const k = _chPalKey(p); return k === '' ? 9000 : k === 'event' ? 4000 : k === '-1' ? 8000 : Number(k); };
const _chPalLabel = p => { const k = _chPalKey(p); return k === '' ? '' : k === 'event' ? 'Event' : k === '-1' ? 'Archive' : 'P' + k; };
const _chModeLabel = m => QUALITY_MODE_LABELS[m] || m;

// Relit le document juste avant d'écrire : un autre admin (ou la page Chasse) a pu le modifier entre-temps.
async function _tdcMutate(fn) {
  const ref = doc(db, 'config', 'tableau_de_chasse');
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  fn(data);
  await setDoc(ref, data);
  _tdcData = data;
}

// Infos reçues via « J'ai des informations » (page Chasse) = reports de catégorie « chasse »
let _chInfos = [];
async function _chLoadInfos() {
  try {
    const snap = await getDocs(collection(db, 'reports'));
    _chInfos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.category === 'chasse' && r.chasse);
  } catch { _chInfos = []; }
}
const _chInfoMatch = (r, m) => r.chasse.mode === m.mode && ((m.id && r.chasse.id === m.id) || (m.name && _chNorm(r.chasse.name) === _chNorm(m.name)));
const _chInfosFor = row => _chInfos.filter(r => _chInfoMatch(r, { mode: row.mode, id: row.id, name: row.name }));

// L'avis est résolu (fiche complétée et validée, ou fermé) : les tickets d'informations n'ont plus lieu d'être
async function _chPurgeInfos(list) {
  const gone = _chInfos.filter(r => list.some(m => _chInfoMatch(r, m)));
  for (const r of gone) { try { await deleteDoc(doc(db, 'reports', r.id)); } catch {} }
  if (gone.length) _chInfos = _chInfos.filter(r => !gone.includes(r));
}

// Retourne les avis fermés pendant le chargement ({ mode, id, name }) pour purger leurs infos
async function _chLoadAvis() {
  _avis = [];
  const closed = [];
  const manual = Array.isArray(_tdcData.avis) ? _tdcData.avis : [];
  const keep = [];
  for (const a of manual) {
    const col = QUALITY_COL_MAP[a.mode];
    if (!col || !a.name) { keep.push(a); continue; }
    let docs = [];
    try { docs = await cachedDocs(col); } catch {}
    const byName = docs.find(x => _chNorm(_chName(x)) === _chNorm(a.name));
    if (a.kind === 'create') {
      if (byName) { closed.push({ mode: a.mode, name: a.name }); continue; } // la fiche existe désormais : ombre dissipée
      keep.push(a); _avis.push({ ...a });
    } else if (a.kind === 'update') {
      const found = docs.find(x => (x.id || x._id) === a.docId) || byName;
      // une soumission approuvée après le lancement de l'avis = fiche remise à jour : l'avis se ferme
      const sub = found ? _subsByDoc[col + '~' + (found.id || found._id)] : null;
      if (sub?.status === 'approved' && (sub.reviewedAt?.seconds || 0) * 1000 > (a.ts || 0)) { closed.push({ mode: a.mode, id: found.id || found._id, name: a.name }); continue; }
      keep.push(a); _avis.push({ ...a, doc: found || null, orphan: !found });
    } else keep.push(a);
  }
  if (keep.length !== manual.length) {
    try { await _tdcMutate(d => { d.avis = (d.avis || []).filter(x => keep.some(k => k.id === x.id)); }); } catch {}
  }
  return closed;
}

function _chRows() {
  const rows = [];
  for (const r of _completionResults) {
    const id = r.doc.id || '';
    const sub = _subsByDoc[(QUALITY_COL_MAP[r.mode] || r.colName) + '~' + id];
    rows.push({
      key: `f:${r.mode}:${id}`, kind: 'fields', mode: r.mode, colName: r.colName, id, name: _chName(r.doc), doc: r.doc,
      missing: r.missing, discVal: r.discVal, palier: r.doc.palier,
      ignored: !!_completionIgnored?.[r.mode]?.has(id),
      published: Array.isArray(_tdcData[r.mode]) && _tdcData[r.mode].includes(id),
      pending: sub?.status === 'pending' || sub?.status === 'changes_requested',
    });
  }
  for (const a of _avis) {
    rows.push({
      key: `a:${a.id}`, kind: a.kind, mode: a.mode, colName: QUALITY_COL_MAP[a.mode], id: a.docId || '', name: a.name, doc: a.doc || null,
      missing: [], note: a.note || '', urgent: !!a.urgent, palier: a.doc?.palier ?? a.palier, avisId: a.id, orphan: !!a.orphan,
      ignored: false, published: true, pending: false,
    });
  }
  return rows;
}

const _chInTab = (r, tab) =>
  tab === 'board'   ? r.published && !r.ignored :
  tab === 'todo'    ? r.kind === 'fields' && !r.published && !r.ignored :
  tab === 'ignored' ? r.ignored : false;

function _chBadge() {
  const n = _chRows().filter(r => !r.ignored).length;
  const badge = document.getElementById('count-incomplete');
  if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
}

function _chFilter(rows, { skipMode = false, skipKind = false } = {}) {
  const q = _chNorm(_ch.q);
  return rows.filter(r =>
    _chInTab(r, _ch.tab) &&
    (skipKind || !_ch.kind || r.kind === _ch.kind) &&
    (skipMode || !_ch.mode || r.mode === _ch.mode) &&
    (!_ch.field || r.missing.includes(_ch.field)) &&
    (!_ch.palier || _chPalKey(r.palier) === _ch.palier) &&
    (!q || _chNorm(r.name).includes(q) || _chNorm(r.id).includes(q) || _chNorm(r.note).includes(q))
  );
}

function _chSorted(list) {
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
  return [...list].sort((a, b) =>
    (!!b.urgent - !!a.urgent) ||
    (_ch.sort === 'missing' ? (b.missing.length - a.missing.length) : _ch.sort === 'palier' ? (_chRank(a.palier) - _chRank(b.palier)) : 0) ||
    byName(a, b));
}

// ── Rendu ───────────────────────────────────────────────
function _chRenderStats(rows) {
  const board = rows.filter(r => _chInTab(r, 'board'));
  const n = k => board.filter(r => r.kind === k).length;
  const tile = (kind, moon, label, count, sub) => `
    <button type="button" class="ch-stat${_ch.tab === 'board' && _ch.kind === kind ? ' on' : ''}" data-kind="${kind}">
      <span class="ch-stat-moon">${moon}</span>
      <span class="ch-stat-n">${count}</span>
      <span class="ch-stat-l">${label}</span>
      <span class="ch-stat-s">${sub}</span>
    </button>`;
  document.getElementById('ch-stats').innerHTML =
    tile('',       '🌕', 'Sur le tableau', board.length, 'visible par les joueurs') +
    tile('create', '🌑', 'Fiches à créer', n('create'), 'nom connu, fiche absente') +
    tile('fields', '🌓', 'Champs manquants', n('fields'), 'fiche à compléter') +
    tile('update', '🌘', 'À raviver', n('update'), 'fiche à mettre à jour');
}

function _chRenderTabs(rows) {
  const cnt = t => rows.filter(r => _chInTab(r, t)).length;
  document.getElementById('ch-tabs').innerHTML = _CH_TABS.map(t => {
    const n = t.id === 'images' ? (_brokenCache ? _brokenCache.length : '') : cnt(t.id);
    return `<button type="button" role="tab" class="ch-tab${_ch.tab === t.id ? ' on' : ''}" data-tab="${t.id}">${t.label}${n !== '' ? `<span class="ch-tab-n">${n}</span>` : ''}</button>`;
  }).join('');
}

function _chRenderToolbar(rows) {
  const isImg = _ch.tab === 'images';
  document.getElementById('ch-toolbar').style.display = isImg ? 'none' : '';
  document.getElementById('ch-chips').style.display = isImg ? 'none' : '';
  if (isImg) return;
  const tabRows = rows.filter(r => _chInTab(r, _ch.tab));
  // champs manquants proposés = ceux qui existent vraiment dans l'onglet
  const fields = [...new Set(tabRows.flatMap(r => r.missing))].sort();
  if (_ch.field && !fields.includes(_ch.field)) _ch.field = '';
  const sel = document.getElementById('completion-filter-field');
  sel.innerHTML = '<option value="">Tous les champs</option>' +
    fields.map(f => `<option value="${escHtml(f)}"${f === _ch.field ? ' selected' : ''}>${escHtml(_CH_FIELD_LABELS[f] || f)}</option>`).join('');
  sel.style.display = fields.length ? '' : 'none';
  document.getElementById('ch-palier').value = _ch.palier;
  document.getElementById('ch-sort').value = _ch.sort;

  const base = _chFilter(rows, { skipMode: true });
  const chips = Object.keys(QUALITY_MODE_LABELS);
  document.getElementById('ch-chips').innerHTML =
    `<button type="button" class="ch-chip${_ch.mode ? '' : ' on'}" data-mode="">Tout<span>${base.length}</span></button>` +
    chips.map(m => `<button type="button" class="ch-chip${_ch.mode === m ? ' on' : ''}" data-mode="${m}">${escHtml(_chModeLabel(m))}<span>${base.filter(r => r.mode === m).length}</span></button>`).join('');

  const bulk = document.getElementById('ch-bulk');
  const launchable = _ch.tab === 'todo' ? _chFilter(rows).filter(r => !r.pending) : [];
  bulk.hidden = !launchable.length;
  bulk.textContent = `🎯 Lancer les ${launchable.length} affichés`;
}

function _chRowHtml(r) {
  const K = _CH_KINDS[r.kind];
  const sub = r.discVal ? _subcatLabel(r.mode, r.discVal) : null;
  const pal = _chPalLabel(r.palier);
  const what = r.kind === 'fields'
    ? `<div class="ch-miss-wrap">${r.missing.map(f => `<span class="ch-miss">${escHtml(_CH_FIELD_LABELS[f] || f)}</span>`).join('')}</div>`
    : `<div class="ch-note">${r.orphan ? '⚠️ Fiche introuvable — ' : ''}${r.note ? escHtml(r.note) : (r.kind === 'create' ? 'Nom connu, fiche inexistante.' : 'Fiche à mettre à jour.')}</div>`;

  const b = (act, label, cls = '', title = '') => `<button type="button" class="ch-btn ${cls}" data-act="${act}"${title ? ` title="${escHtml(title)}"` : ''}>${label}</button>`;
  const nInfos = _chInfosFor(r).length;
  const infoBtn = nInfos ? b('infos', `💬 ${nInfos}`, _ch.openInfo.has(r.key) ? 'on-info' : '', `${nInfos} information${nInfos > 1 ? 's' : ''} reçue${nInfos > 1 ? 's' : ''} des joueurs`) : '';
  let acts = '';
  if (r.kind === 'fields') {
    if (r.ignored) acts = b('unignore', '↩ Réactiver');
    else if (r.pending) acts = infoBtn + '<span class="ch-pending">⏳ En attente de modération</span>';
    else {
      acts += infoBtn;
      acts += r.published ? b('unpublish', 'Retirer', '', 'Retirer de la Chasse') : b('publish', '🎯 Lancer', 'prime', 'Afficher sur la page Chasse');
      acts += b('fix', _ch.open.has(r.key) ? '⚡ Replier' : '⚡ Remplir', 'ghost', 'Compléter les champs ici');
      acts += b('edit', '✏️', 'icon', 'Éditer dans la modération');
      acts += b('creator', '⚙️', 'icon', 'Ouvrir dans le Creator');
      acts += b('ignore', '🚫', 'icon', 'Exception — ne plus signaler');
    }
  } else {
    acts += infoBtn;
    acts += b('urgent', r.urgent ? '🔥 Urgent' : '🔥', r.urgent ? 'on' : 'icon', r.urgent ? 'Retirer l\'urgence' : 'Marquer urgent');
    acts += b('creator', '⚙️', 'icon', r.kind === 'create' ? 'Ouvrir le Creator' : 'Ouvrir dans le Creator');
    acts += b('close', '✕ Éclairer', 'ghost', 'Fermer cet avis');
  }

  return `
  <div class="ch-row${r.urgent ? ' urgent' : ''}${r.ignored ? ' dim' : ''}${r.pending ? ' pend' : ''}${_ch.open.has(r.key) ? ' open' : ''}" data-kind="${r.kind}" data-key="${escHtml(r.key)}">
    <div class="ch-row-main">
      <span class="ch-moon" title="${K.label}">${K.moon}</span>
      <div class="ch-who">
        <div class="ch-name">${escHtml(r.name || '—')}${r.urgent && r.kind === 'fields' ? '' : ''}</div>
        <div class="ch-meta">
          <span class="ch-tag">${escHtml(_chModeLabel(r.mode))}</span>
          ${sub ? `<span class="ch-tag sub">${escHtml(sub)}</span>` : ''}
          ${pal ? `<span class="dq-pal">${escHtml(pal)}</span>` : ''}
          ${r.id ? `<span class="ch-id">${escHtml(r.id)}</span>` : ''}
        </div>
      </div>
      <div class="ch-what">${what}</div>
      <div class="ch-acts">${acts}</div>
    </div>
  </div>`;
}

function _chInfoPanel(r) {
  const box = document.createElement('div');
  box.className = 'ch-infos';
  const when = c => { const d = c?.toDate?.() || (c?.seconds ? new Date(c.seconds * 1000) : null); return d ? d.toLocaleDateString('fr-FR') : ''; };
  const body = t => { const parts = String(t || '').split(/\n\n/); return parts.length > 1 ? parts.slice(1).join('\n\n') : parts[0]; };
  const list = _chInfosFor(r);
  box.innerHTML = `<div class="ch-infos-head">💬 Informations des joueurs</div>` +
    (list.length ? list.map(i => `
      <div class="ch-info" data-rid="${escHtml(i.id)}">
        <div class="ch-info-who">${escHtml(i.pseudo || 'Anonyme')}${i.submittedBy ? '' : ' <i>(non connecté)</i>'} <span>${escHtml(when(i.createdAt))}</span>
          <button type="button" class="ch-btn icon" data-act="del-info" data-rid="${escHtml(i.id)}" title="Supprimer cette information">🗑️</button></div>
        <div class="ch-info-text">${escHtml(body(i.text))}</div>
      </div>`).join('') : '<div class="ch-note">Plus aucune information.</div>') +
    '<div class="ch-fix-hint" style="margin-top:8px;">Ces informations disparaissent quand la fiche est complétée et validée.</div>';
  return box;
}

function _chFixPanel(r) {
  const safeId = (r.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const box = document.createElement('div');
  box.className = 'ch-fix';
  const wrap = document.createElement('div');
  wrap.id = `completion-fields-${safeId}`;
  wrap.className = 'ch-fix-fields';
  for (const f of r.missing) {
    const cell = document.createElement('div');
    cell.className = 'ch-fix-cell';
    const lbl = document.createElement('label');
    lbl.textContent = _CH_FIELD_LABELS[f] || f;
    cell.appendChild(lbl);
    cell.appendChild(_buildCompletionInput(f, r.mode, r.doc[f] != null ? r.doc[f] : undefined));
    wrap.appendChild(cell);
  }
  box.appendChild(wrap);
  const foot = document.createElement('div');
  foot.className = 'ch-fix-foot';
  foot.innerHTML = `<button type="button" class="ch-btn prime" data-act="save-fix">💾 Enregistrer</button><span id="completion-status-${safeId}" class="ch-fix-status"></span><span class="ch-fix-hint">Seuls les champs remplis sont enregistrés.</span>`;
  box.appendChild(foot);
  return box;
}

window.renderCompletion = function renderCompletion() {
  const rows = _chRows();
  _chRenderStats(rows);
  _chRenderTabs(rows);
  _chRenderToolbar(rows);
  _chBadge();
  const list = document.getElementById('completion-list');
  if (_ch.tab === 'images') { _chRenderImages(list); return; }

  const shown = _chSorted(_chFilter(rows));
  if (!shown.length) {
    const filtered = !!(_ch.q || _ch.field || _ch.palier || _ch.mode || _ch.kind);
    const msg = filtered ? ['🌫️', 'Aucune ombre ne correspond à ces filtres.']
      : _ch.tab === 'board'   ? ['🌕', 'Le tableau est vide. Lance un avis depuis « À lancer », ou crée-en un avec « ＋ Nouvel avis ».']
      : _ch.tab === 'todo'    ? ['🌕', 'Rien à lancer : toutes les fiches incomplètes sont déjà sur le tableau.']
      :                         ['☾', 'Aucune exception.'];
    list.innerHTML = `<div class="ch-state"><div class="ch-state-i">${msg[0]}</div><p>${msg[1]}</p></div>`;
    return;
  }
  list.innerHTML = shown.map(_chRowHtml).join('');
  for (const r of shown) {
    if (!_ch.open.has(r.key) || r.kind !== 'fields') continue;
    const el = list.querySelector(`.ch-row[data-key="${CSS.escape(r.key)}"]`);
    if (el) el.appendChild(_chFixPanel(r));
  }
  for (const r of shown) {
    if (!_ch.openInfo.has(r.key)) continue;
    const el = list.querySelector(`.ch-row[data-key="${CSS.escape(r.key)}"]`);
    if (el) el.appendChild(_chInfoPanel(r));
  }
};

async function _chRenderImages(list) {
  const head = t => `<div class="ch-state"><div class="ch-state-i">🖼️</div><p>${t}</p></div>`;
  if (!_brokenCache) {
    list.innerHTML = head('Vérification des images…');
    try {
      const itemDocs = await _loadItemDocsForImageCheck();
      _brokenCache = await _checkBrokenImages(itemDocs, (done, total) => {
        if (_ch.tab === 'images') list.innerHTML = head(`Vérification des images… ${done} / ${total}`);
      });
    } catch { if (_ch.tab === 'images') list.innerHTML = head('Erreur lors de la vérification.'); return; }
    _chRenderTabs(_chRows());
  }
  if (_ch.tab !== 'images') return;
  if (!_brokenCache.length) { list.innerHTML = head('Toutes les images sont accessibles ✓'); return; }
  list.innerHTML = _brokenCache.map(({ doc: d, brokenUrls }) => {
    const sens = d._sensible === true;
    const editKey = sens ? (d._docKey || '') : (d.id || '');
    return `
    <div class="ch-row" data-kind="img">
      <div class="ch-row-main">
        <span class="ch-moon">🖼️</span>
        <div class="ch-who"><div class="ch-name">${escHtml(d.name || d.id || '—')}</div><div class="ch-meta"><span class="ch-tag">⚔️ Items</span><span class="ch-id">${escHtml(d.id || '')}</span></div></div>
        <div class="ch-what">${brokenUrls.map(u => `<div class="ch-url">⛔ ${escHtml(u)}</div>`).join('')}</div>
        <div class="ch-acts"><button type="button" class="ch-btn" onclick="_openItemForCompletion('${escHtml(editKey)}',${sens},'completion')">✏️ Éditer</button></div>
      </div>
    </div>`;
  }).join('');
}

// ── Actions ─────────────────────────────────────────────
async function _chPublish(rows, on) {
  await _tdcMutate(d => {
    for (const r of rows) {
      const arr = Array.isArray(d[r.mode]) ? d[r.mode] : [];
      d[r.mode] = on ? (arr.includes(r.id) ? arr : [...arr, r.id]) : arr.filter(x => x !== r.id);
    }
  });
}

async function _chAct(act, r, btn) {
  // seules les actions qui écrivent dans la base verrouillent le bouton (« Remplir » doit pouvoir se refermer)
  if (btn && ['publish', 'unpublish', 'urgent', 'close'].includes(act)) btn.disabled = true;
  try {
    if (act === 'publish' || act === 'unpublish') {
      await _chPublish([r], act === 'publish');
      toast(act === 'publish' ? `🎯 « ${r.name} » est sur le tableau` : `« ${r.name} » retiré du tableau`);
    } else if (act === 'ignore' || act === 'unignore') {
      if (act === 'ignore') window.ignoreCompletionDoc(r.mode, r.id, null); else window.unignoreCompletionDoc(r.mode, r.id, null);
      return;
    } else if (act === 'fix') {
      const el = document.querySelector(`#completion-list .ch-row[data-key="${CSS.escape(r.key)}"]`);
      if (!el) return;
      const open = el.classList.toggle('open');
      open ? _ch.open.add(r.key) : _ch.open.delete(r.key);
      if (btn) btn.textContent = open ? '⚡ Replier' : '⚡ Remplir';
      const ex = el.querySelector(':scope > .ch-fix');
      if (open && !ex) el.appendChild(_chFixPanel(r)); else if (!open && ex) ex.remove();
      return;
    } else if (act === 'infos') {
      const el = document.querySelector(`#completion-list .ch-row[data-key="${CSS.escape(r.key)}"]`);
      if (!el) return;
      const ex = el.querySelector(':scope > .ch-infos');
      if (ex) { ex.remove(); _ch.openInfo.delete(r.key); btn.classList.remove('on-info'); }
      else { el.appendChild(_chInfoPanel(r)); _ch.openInfo.add(r.key); btn.classList.add('on-info'); }
      return;
    } else if (act === 'del-info') {
      if (!confirm('Supprimer cette information ?')) return;
      await deleteDoc(doc(db, 'reports', btn.dataset.rid));
      _chInfos = _chInfos.filter(i => i.id !== btn.dataset.rid);
    } else if (act === 'save-fix') {
      await window.saveCompletionFields(r.mode, r.id, btn);
      return;
    } else if (act === 'edit') {
      window.showEditor(r.colName, r.id, null, 'completion');
      return;
    } else if (act === 'creator') {
      if (r.id) window.openCompletionInCreator(r.colName, r.id);
      else {
        const cre = { items: 'item', mobs: 'mob', pnj: 'pnj', regions: 'region', quetes: 'quest', panoplies: 'panoplie' }[r.mode] || 'item';
        sessionStorage.setItem('chasseNew', JSON.stringify({ type: cre, name: r.name }));
        window.open(`creator.html?mode=${cre}`, '_blank');
      }
      return;
    } else if (act === 'urgent') {
      await _tdcMutate(d => { const a = (d.avis || []).find(x => x.id === r.avisId); if (a) a.urgent = !a.urgent; });
      const a = _avis.find(x => x.id === r.avisId); if (a) a.urgent = !a.urgent;
    } else if (act === 'close') {
      if (!confirm(`Marquer « ${r.name} » comme éclairé ? L'avis disparaît de la Chasse.`)) return;
      await _tdcMutate(d => { d.avis = (d.avis || []).filter(x => x.id !== r.avisId); });
      _avis = _avis.filter(x => x.id !== r.avisId);
      await _chPurgeInfos([{ mode: r.mode, id: r.id, name: r.name }]);
    }
    renderCompletion();
  } catch (e) {
    toast('⛔ ' + e.message, 'error');
    if (btn) btn.disabled = false;
  }
}

window.ignoreCompletionDoc = async (mode, docId, btn) => {
  if (!_completionIgnored) _completionIgnored = {};
  if (!_completionIgnored[mode]) _completionIgnored[mode] = new Set();
  _completionIgnored[mode].add(docId);
  if (btn) btn.disabled = true;
  try { await _saveCompletionIgnored(); renderCompletion(); }
  catch (e) { toast('⛔ ' + e.message, 'error'); _completionIgnored[mode].delete(docId); if (btn) btn.disabled = false; }
};

window.unignoreCompletionDoc = async (mode, docId, btn) => {
  _completionIgnored?.[mode]?.delete(docId);
  if (btn) btn.disabled = true;
  try { await _saveCompletionIgnored(); renderCompletion(); }
  catch (e) { toast('⛔ ' + e.message, 'error'); if (btn) btn.disabled = false; }
};

// ── Composeur d'avis ────────────────────────────────────
function _chComposer() {
  const box = document.getElementById('ch-composer');
  const modes = Object.keys(QUALITY_MODE_LABELS);
  box.innerHTML = `
    <div class="ch-comp-head"><h3>☾ Lancer un avis</h3><button type="button" class="ch-btn icon" id="cf-close" title="Fermer">✕</button></div>
    <div class="ch-comp-kinds">
      <label class="ch-comp-kind on"><input type="radio" name="cf-kind" value="create" checked><span class="m">🌑</span><span><b>Fiche à créer</b><small>Le nom est connu, la fiche n'existe pas.</small></span></label>
      <label class="ch-comp-kind"><input type="radio" name="cf-kind" value="update"><span class="m">🌘</span><span><b>À raviver</b><small>La fiche est complète mais périmée.</small></span></label>
    </div>
    <div class="ch-comp-grid">
      <select class="ch-input" id="cf-mode">${modes.map(m => `<option value="${m}">${escHtml(_chModeLabel(m))}</option>`).join('')}</select>
      <input class="ch-input" id="cf-name" list="cf-names" placeholder="Nom de la fiche" autocomplete="off">
      <select class="ch-input" id="cf-palier"><option value="">Palier ?</option><option value="1">Palier 1</option><option value="2">Palier 2</option><option value="3">Palier 3</option><option value="event">Event</option></select>
    </div>
    <datalist id="cf-names"></datalist>
    <textarea class="ch-input" id="cf-note" rows="2" placeholder="Indice ou raison — ex : « drop du boss de la mine », « stats changées au patch 1.4 »"></textarea>
    <div class="ch-comp-foot">
      <label class="ch-check"><input type="checkbox" id="cf-urgent"> 🔥 Urgent</label>
      <span class="ch-comp-msg" id="cf-msg"></span>
      <button type="button" class="btn" id="cf-save">Publier l'avis</button>
    </div>`;
  const kindOf = () => box.querySelector('input[name="cf-kind"]:checked').value;
  const refreshNames = async () => {
    const dl = document.getElementById('cf-names');
    if (kindOf() !== 'update') { dl.innerHTML = ''; return; }
    let docs = []; try { docs = await cachedDocs(QUALITY_COL_MAP[document.getElementById('cf-mode').value]); } catch {}
    dl.innerHTML = docs.map(d => `<option value="${escHtml(_chName(d))}">`).join('');
  };
  box.querySelectorAll('input[name="cf-kind"]').forEach(r => r.addEventListener('change', () => {
    box.querySelectorAll('.ch-comp-kind').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    refreshNames();
  }));
  document.getElementById('cf-mode').onchange = refreshNames;
  document.getElementById('cf-close').onclick = () => box.classList.remove('open');
  document.getElementById('cf-save').onclick = async () => {
    const kind = kindOf(), mode = document.getElementById('cf-mode').value;
    const name = document.getElementById('cf-name').value.trim();
    const msg = document.getElementById('cf-msg'); msg.textContent = '';
    if (!name) { msg.textContent = 'Donne un nom.'; return; }
    let docs = []; try { docs = await cachedDocs(QUALITY_COL_MAP[mode]); } catch {}
    const found = docs.find(x => _chNorm(_chName(x)) === _chNorm(name));
    if (kind === 'create' && found) { msg.textContent = 'Une fiche porte déjà ce nom.'; return; }
    if (kind === 'update' && !found) { msg.textContent = 'Fiche introuvable : choisis un nom dans la liste.'; return; }
    if (_avis.some(a => a.kind === kind && a.mode === mode && _chNorm(a.name) === _chNorm(name))) { msg.textContent = 'Cet avis existe déjà.'; return; }
    const pal = document.getElementById('cf-palier').value;
    const entry = {
      id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      kind, mode, name: found ? _chName(found) : name,
      ...(kind === 'update' ? { docId: found.id || found._id } : {}),
      note: document.getElementById('cf-note').value.trim(),
      urgent: document.getElementById('cf-urgent').checked,
      ...(pal ? { palier: pal === 'event' ? 'event' : Number(pal) } : {}),
      ts: Date.now(),
    };
    const save = document.getElementById('cf-save'); save.disabled = true;
    try {
      await _tdcMutate(d => { d.avis = [...(d.avis || []), entry]; });
      await _chLoadAvis();
      box.classList.remove('open');
      _ch.tab = 'board'; _ch.kind = '';
      renderCompletion();
      toast(`${kind === 'create' ? '🌑' : '🌘'} Avis lancé : « ${entry.name} »`);
    } catch (e) { msg.textContent = 'Échec : ' + e.message; }
    save.disabled = false;
  };
  refreshNames();
}

// ── Câblage (une seule fois) ────────────────────────────
function _chWire() {
  const $ = id => document.getElementById(id);
  if (!$('completion-panel') || $('completion-panel')._chWired) return;
  $('completion-panel')._chWired = true;
  const rerender = () => renderCompletion();
  $('ch-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; _ch.tab = b.dataset.tab; _ch.kind = ''; rerender(); });
  $('ch-stats').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; _ch.tab = 'board'; _ch.kind = b.dataset.kind; rerender(); });
  $('ch-chips').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; _ch.mode = b.dataset.mode; rerender(); });
  $('ch-q').addEventListener('input', e => { _ch.q = e.target.value; rerender(); });
  $('completion-filter-field').addEventListener('change', e => { _ch.field = e.target.value; rerender(); });
  $('ch-palier').addEventListener('change', e => { _ch.palier = e.target.value; rerender(); });
  $('ch-sort').addEventListener('change', e => { _ch.sort = e.target.value; rerender(); });
  $('ch-new').addEventListener('click', () => {
    const box = $('ch-composer');
    if (!box.firstChild) _chComposer();
    box.classList.toggle('open');
    if (box.classList.contains('open')) { $('cf-name').focus(); box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  });
  $('ch-bulk').addEventListener('click', async () => {
    const rows = _chFilter(_chRows()).filter(r => !r.pending);
    if (!rows.length) return;
    if (rows.length > 1 && !confirm(`Lancer ${rows.length} fiches sur la Chasse ?`)) return;
    try { await _chPublish(rows, true); toast(`🎯 ${rows.length} fiche${rows.length > 1 ? 's' : ''} lancée${rows.length > 1 ? 's' : ''}`); rerender(); }
    catch (e) { toast('⛔ ' + e.message, 'error'); }
  });
  $('completion-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const rowEl = btn.closest('.ch-row'); if (!rowEl) return;
    const r = _chRows().find(x => x.key === rowEl.dataset.key); if (!r) return;
    _chAct(btn.dataset.act, r, btn);
  });
}
_chWire();

window.saveCompletionFields = async (mode, docId, btn) => {
  const colName = QUALITY_COL_MAP[mode] || ({ mob:'mobs', quete:'quetes', region:'regions' }[mode]) || mode;
  if (!hasRole(ctx.role, 'contributeur')) { toast('⛔ Accès refusé', 'error'); return; }
  const safeDocId  = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fieldsWrap = document.getElementById(`completion-fields-${safeDocId}`);
  const status     = document.getElementById(`completion-status-${safeDocId}`);
  if (!fieldsWrap) return;

  const patch = {};

  // input / select / textarea avec data-field (hors checkbox et color picker)
  for (const el of fieldsWrap.querySelectorAll('input[data-field]:not([type=checkbox]):not([type=color]), select[data-field], textarea[data-field]')) {
    const f = el.dataset.field;
    const v = el.value.trim();
    if (!v) continue;
    patch[f] = _NUMERIC_CF_FIELDS.has(f) && !isNaN(Number(v)) ? Number(v) : v;
  }

  // div[data-field] = multicheckbox
  for (const wrap of fieldsWrap.querySelectorAll('div[data-field]')) {
    const f       = wrap.dataset.field;
    const checked = [...wrap.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
    if (checked.length) patch[f] = checked;
  }

  if (!Object.keys(patch).length) { toast('⚠️ Aucun champ rempli', 'warning'); return; }
  try {
    if (btn) btn.disabled = true;
    await updateDoc(doc(db, colName, docId), patch);
    invalidateModCache(colName);
    await loadCompletion();
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; }
    if (btn) btn.disabled = false;
  }
};

window.openCompletionInCreator = async function(colName, docId) {
  let data = null;
  try {
    const snap = await getDoc(doc(db, colName, docId));
    if (snap.exists()) data = { id: snap.id, ...snap.data() };
  } catch(e) {
    toast('⛔ Impossible de charger le document : ' + e.message, 'error');
    return;
  }
  if (!data) { toast('⛔ Document introuvable.', 'error'); return; }
  const typeMap = { items:'item', mobs:'mob', personnages:'pnj', regions:'region', quetes:'quest', panoplies:'panoplie' };
  const type = typeMap[colName] || 'item';
  sessionStorage.setItem('editSub', JSON.stringify({ type, data }));
  window.open('creator.html', '_blank');
};

// ── Creator Validation Config (Champs requis) ──────────
const QUALITY_FIELD_SCHEMA = {
  items: [
    { id: 'name',     label: 'Nom affiché' },
    { id: 'rarity',   label: 'Rareté' },
    { id: 'category', label: 'Catégorie' },
    { id: 'palier',   label: 'Palier' },
    { id: 'event',    label: 'Évènement (palier Event uniquement)' },
    { id: 'lvl',      label: 'Niveau requis' },
    { id: 'images',   label: 'Image' },
    { id: 'lore',     label: 'Lore' },
    { id: 'obtain',   label: 'Obtention' },
    { id: 'stats',    label: 'Stats' },
    { id: 'effects',  label: 'Effets' },
    { id: 'cat',      label: 'Slot interne' },
    { id: 'craft_cd', label: 'CD de craft' },
  ],
  mobs: [
    { id: 'name',   label: 'Nom' },
    { id: 'type',   label: 'Type' },
    { id: 'palier', label: 'Palier' },
    { id: 'region', label: 'Région' },
    { id: 'lore',   label: 'Lore (Codex)' },
    { id: 'loot',   label: 'Loot' },
  ],
  pnj: [
    { id: 'name',   label: 'Nom' },
    { id: 'type',   label: 'Type' },
    { id: 'coords', label: 'Coordonnées' },
    { id: 'region', label: 'Région' },
    { id: 'palier', label: 'Palier' },
  ],
  regions: [
    { id: 'name',   label: 'Nom' },
    { id: 'palier', label: 'Palier' },
    { id: 'lore',   label: 'Lore (Codex)' },
    { id: 'images', label: 'Image' },
  ],
  quetes: [
    { id: 'titre',      label: 'Titre' },
    { id: 'type',       label: 'Type' },
    { id: 'palier',     label: 'Palier' },
    { id: 'zone',       label: 'Zone' },
    { id: 'npc',        label: 'PNJ donneur' },
    { id: 'desc',       label: 'Description' },
    { id: 'objectifs',  label: 'Objectifs' },
    { id: 'recompenses',label: 'Récompenses' },
  ],
  panoplies: [
    { id: 'label',   label: 'Nom' },
    { id: 'bonuses', label: 'Bonus' },
    { id: 'images',  label: 'Image' },
  ],
};

const QUALITY_COL_MAP = {
  items: COL.items, mobs: COL.mobs, pnj: COL.pnj,
  regions: COL.regions, quetes: COL.quetes, panoplies: COL.panoplies,
};

const QUALITY_MODE_LABELS = {
  items:     '⚔️ Items',
  mobs:      '👾 Mobs',
  pnj:       '🧑 PNJ',
  regions:   '📍 Régions',
  quetes:    '📜 Quêtes',
  panoplies: '🔗 Panoplies',
};

// Champ discriminant par mode (détermine la sous-catégorie d'un doc)
const QUALITY_DISCRIMINANT = {
  items:  'category',
  mobs:   'type',
  quetes: 'type',
};

// Sous-catégories connues par mode (UI + règles byCategory)
const QUALITY_SUBCATEGORIES = {
  items: [
    { id: 'arme',        label: '⚔️ Arme' },
    { id: 'armure',      label: '🛡️ Armure' },
    { id: 'accessoire',  label: '💍 Accessoire' },
    { id: 'materiaux',   label: '🧱 Matériau' },
    { id: 'ressources',  label: '⛏️ Ressource' },
    { id: 'consommable', label: '🧪 Consommable' },
    { id: 'nourriture',  label: '🍖 Nourriture' },
    { id: 'outils',      label: '🔧 Outil' },
    { id: 'rune',        label: '🔮 Rune' },
    { id: 'parchemin',   label: '📃 Parchemin' },
    { id: 'quete',       label: '📜 Objet Quête' },
    { id: 'donjon',      label: '🏰 Donjon' },
  ],
  mobs: [
    { id: 'monstre',   label: '👹 Monstre' },
    { id: 'sbire',     label: '💀 Sbire' },
    { id: 'mini_boss', label: '⚡ Mini-Boss' },
    { id: 'worldboss', label: '🌍 WorldBoss' },
    { id: 'boss',      label: '🔥 Boss' },
  ],
  quetes: [
    { id: 'main', label: '⚔️ Principale' },
    { id: 'sec',  label: '🗺️ Secondaire' },
    { id: 'fu',  label: '📋 Fractured Underworld' },
  ],
};

// _cvData: { [mode]: { required: Set<string>, byCategory: { [subcat]: Set<string> } } }
let _cvData    = {};
let _cvMode    = 'items';
let _cvSubMode = {}; // mode → sous-catégorie sélectionnée dans l'UI
let _cvDirty   = false;
let _cvStats   = {}; // { [mode]: { [fieldId]: count } } — nb docs manquant ce champ

function _cvModeData(mode) {
  if (!_cvData[mode]) _cvData[mode] = { required: new Set(), byCategory: {} };
  return _cvData[mode];
}
function _cvSubData(mode, subcat) {
  const md = _cvModeData(mode);
  if (!md.byCategory[subcat]) md.byCategory[subcat] = new Set();
  return md.byCategory[subcat];
}

window.showCreatorValidation = async () => {
  if (!ctx.hasCap('wiki')) { toast('⛔ Réservé aux admins', 'error'); return; }
  _cvStats = {};
  _setHash('creator-validation');
  document.getElementById('creator-validation-panel').style.display = '';
  document.getElementById('btn-creator-validation').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadCreatorValidation();
};

window.loadCreatorValidation = async () => {
  const status = document.getElementById('cv-status');
  try {
    const snap = await getDoc(doc(db, 'config', 'data_quality_standards'));
    const _normF = f => (f === 'img' || f === 'image') ? 'images' : f;
    _cvData = {};
    if (snap.exists()) {
      for (const [mode, cfg] of Object.entries(snap.data())) {
        _cvData[mode] = { required: new Set((cfg.required || []).map(_normF)), byCategory: {} };
        for (const [subcat, scfg] of Object.entries(cfg.byCategory || {})) {
          _cvData[mode].byCategory[subcat] = new Set((scfg.required || []).map(_normF));
        }
      }
    }
    _renderCvUI();
    if (status) status.style.display = 'none';
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; status.style.display = ''; }
  }
};

async function _computeCvStats(mode) {
  if (_cvStats[mode]) return;
  const col = QUALITY_COL_MAP[mode];
  if (!col) return;
  await _loadCompletionIgnored();
  const allDocs = await cachedDocs(col);
  const ignoredSet = _completionIgnored?.[mode] || new Set();
  const docs = allDocs.filter(d => !ignoredSet.has(d.id || ''));
  const fields = QUALITY_FIELD_SCHEMA[mode] || [];
  const discriminant = QUALITY_DISCRIMINANT[mode];
  const subCats = QUALITY_SUBCATEGORIES[mode] || [];

  // global counts (ignorés exclus)
  const global = {};
  for (const f of fields) global[f.id] = docs.filter(d => _fieldEmpty(d, f.id)).length;

  // per-subcategory counts
  const byCategory = {};
  if (discriminant && subCats.length) {
    for (const sc of subCats) {
      const subset = docs.filter(d => d[discriminant] === sc.id);
      const counts = {};
      for (const f of fields) counts[f.id] = subset.filter(d => _fieldEmpty(d, f.id)).length;
      byCategory[sc.id] = counts;
    }
  }

  _cvStats[mode] = { global, byCategory };
}

function _renderCvFieldGrid(fields, reqSet, scope, subcat) {
  const subcatAttr = subcat ? ` data-subcat="${subcat}"` : '';
  const modeStats = _cvStats[_cvMode] || {};
  return fields.map(f => {
    const counts = scope === 'bycat' && subcat
      ? modeStats.byCategory?.[subcat]
      : modeStats.global;
    const count = counts?.[f.id];
    const impactHtml = count != null
      ? `<span class="cv-field-impact${count > 0 ? ' has-missing' : ''}" title="${count} doc${count !== 1 ? 's' : ''} manquant ce champ">${count}</span>`
      : `<span class="cv-field-impact">—</span>`;
    return `<div class="cv-field-row">
      <span class="cv-field-label">${f.label || f.id}</span>
      ${impactHtml}
      <div class="cv-field-toggle-wrap">
        <button class="perm-toggle ${reqSet.has(f.id) ? 'on' : 'off'}"
          data-mode="${_cvMode}" data-scope="${scope}" data-field="${f.id}"${subcatAttr}
          onclick="window._onCvToggle(this)" title="${reqSet.has(f.id) ? 'Requis' : 'Optionnel'}">
        </button>
      </div>
    </div>`;
  }).join('');
}

function _renderCvUI() {
  const tabsEl = document.getElementById('cv-tabs');
  if (!tabsEl) return;

  tabsEl.innerHTML = Object.entries(QUALITY_MODE_LABELS).map(([m, lbl]) => {
    const reqCount = _cvData[m]?.required?.size || 0;
    return `<button class="cv-mode-tab${m === _cvMode ? ' active' : ''}" onclick="window._setCvMode('${m}')">
      ${lbl} <span class="cv-mode-req-count">${reqCount}</span>
    </button>`;
  }).join('');

  const grid    = document.getElementById('cv-grid');
  const fields  = QUALITY_FIELD_SCHEMA[_cvMode] || [];
  const md      = _cvModeData(_cvMode);
  const subCats = QUALITY_SUBCATEGORIES[_cvMode] || [];
  const globalCount = md.required.size;

  let html = `<div class="cv-section">
    <div class="cv-section-header">
      <span class="cv-section-title">Toujours requis</span>
      ${globalCount ? `<span class="cv-section-count">${globalCount} champ${globalCount > 1 ? 's' : ''}</span>` : ''}
    </div>
    ${_renderCvFieldGrid(fields, md.required, 'global', null)}
  </div>`;

  if (subCats.length) {
    const selSub = _cvSubMode[_cvMode] || subCats[0].id;
    if (!_cvSubMode[_cvMode]) _cvSubMode[_cvMode] = selSub;
    const subReq = _cvSubData(_cvMode, selSub);
    const subCount = subReq.size;

    html += `<div class="cv-section">
      <div class="cv-section-header">
        <span class="cv-section-title">Par catégorie</span>
        ${subCount ? `<span class="cv-section-count">${subCount} champ${subCount > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="cv-subcat-bar">
        ${subCats.map(sc => `<button class="cv-subcat-btn${sc.id === selSub ? ' active' : ''}"
          onclick="window._setCvSubMode('${sc.id}')">${sc.label}</button>`).join('')}
      </div>
      ${_renderCvFieldGrid(fields, subReq, 'bycat', selSub)}
    </div>`;
  }

  grid.innerHTML = html;

  if (!_cvStats[_cvMode]) {
    _computeCvStats(_cvMode).then(() => _renderCvUI());
  }
}

window._setCvMode    = (m)  => { _cvMode = m; _renderCvUI(); };
window._setCvSubMode = (sc) => { _cvSubMode[_cvMode] = sc; _renderCvUI(); };
window._onCvToggle   = (btn) => {
  const { mode, scope, field, subcat } = btn.dataset;
  const isOn = btn.classList.contains('on');
  btn.classList.toggle('on', !isOn);
  btn.classList.toggle('off', isOn);
  btn.title = !isOn ? 'Requis' : 'Optionnel';
  if (scope === 'global') {
    const req = _cvModeData(mode).required;
    !isOn ? req.add(field) : req.delete(field);
  } else {
    const req = _cvSubData(mode, subcat);
    !isOn ? req.add(field) : req.delete(field);
  }
  _cvDirty = true;
  const saveBtn = document.getElementById('btn-save-creator-validation');
  if (saveBtn) saveBtn.classList.add('cv-save-dirty');
  _renderCvUI();
};

window.saveCreatorValidation = async () => {
  const status = document.getElementById('cv-status');
  const btn    = document.getElementById('btn-save-creator-validation');
  const payload = {};
  for (const [mode, md] of Object.entries(_cvData)) {
    const entry = {};
    if (md.required?.size) entry.required = [...md.required];
    const byCat = {};
    for (const [subcat, req] of Object.entries(md.byCategory || {})) {
      if (req.size) byCat[subcat] = { required: [...req] };
    }
    if (Object.keys(byCat).length) entry.byCategory = byCat;
    if (Object.keys(entry).length) payload[mode] = entry;
  }
  try {
    if (btn) btn.disabled = true;
    await setDoc(doc(db, 'config', 'data_quality_standards'), payload);
    if (status) { status.textContent = '✓ Sauvegardé'; status.style.color = 'var(--success)'; status.style.display = ''; }
    toast('✓ Champs requis sauvegardés', 'success');
    _cvDirty = false;
    if (btn) { btn.classList.remove('cv-save-dirty'); }
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; status.style.display = ''; }
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ── Data Incomplète ───────────────────────────────────
function _testImageUrl(url) {
  return new Promise(resolve => {
    if (!url || typeof url !== 'string' || url.startsWith('data:')) { resolve(true); return; }
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; resolve(false); }, 8000);
    img.onload  = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
}

function _normalizeUrlForModeration(url) {
  if (!url || typeof url !== 'string') return url;
  let u = url;
  while (u.startsWith('../')) u = u.slice(3);
  return u;
}

async function _checkBrokenImages(docs, onProgress) {
  const BATCH = 8;
  const broken = [];
  const entries = docs.map(d => {
    const urls = [];
    if (d.img   && typeof d.img   === 'string' && !d.img.startsWith('data:'))   urls.push(_normalizeUrlForModeration(d.img));
    if (d.image && typeof d.image === 'string' && !d.image.startsWith('data:')) urls.push(_normalizeUrlForModeration(d.image));
    if (Array.isArray(d.images)) d.images.forEach(u => { if (u && typeof u === 'string' && !u.startsWith('data:')) urls.push(_normalizeUrlForModeration(u)); });
    return { doc: d, urls };
  }).filter(e => e.urls.length > 0);

  let done = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    await Promise.all(entries.slice(i, i + BATCH).map(async ({ doc: d, urls }) => {
      const ok = await Promise.all(urls.map(_testImageUrl));
      const bad = urls.filter((_, j) => !ok[j]);
      if (bad.length) broken.push({ doc: d, brokenUrls: bad });
    }));
    done = Math.min(i + BATCH, entries.length);
    if (onProgress) onProgress(done, entries.length);
  }
  return broken;
}

// Charge tous les items à vérifier : publics + (admin) sensibles fusionnés.
// Les images d'un item sensible peuvent vivre dans items_hidden OU items_secret selon le split gameplay/secret.
async function _loadItemDocsForImageCheck() {
  const pub = await cachedDocs('items').catch(() => []);
  if (ctx.role !== 'admin') return pub;
  const [hidden, secret] = await Promise.all([
    cachedDocs(COL.itemsHidden).catch(() => []),
    cachedDocs(COL.itemsSecret).catch(() => []),
  ]);
  const secretById = new Map(secret.map(s => [String(s.id), s]));
  const seen = new Set();
  const sensible = [];
  for (const h of hidden) {
    const s = h.id ? (secretById.get(String(h.id)) || {}) : {};
    sensible.push({ ...h, ...s, _docKey: h._docKey, _sensible: true });
    if (h.id) seen.add(String(h.id));
  }
  for (const s of secret) {
    if (!seen.has(String(s.id))) sensible.push({ ...s, _sensible: true });
  }
  return [...pub, ...sensible];
}

// Ouvre le bon éditeur pour un item public ou sensible depuis la liste "Tableau de chasse".
window._openItemForCompletion = async function(key, sensible, origin) {
  if (!sensible) { showEditor('items', key, null, origin || 'completion'); return; }
  const [hidden, secret] = await Promise.all([
    cachedDocs(COL.itemsHidden).catch(() => []),
    cachedDocs(COL.itemsSecret).catch(() => []),
  ]);
  const h = hidden.find(x => x._docKey === key);
  if (!h) { toast('⛔ Item sensible introuvable.', 'error'); return; }
  const s = h.id ? (secret.find(x => String(x._docKey) === String(h.id)) || {}) : {};
  const merged = {};
  for (const [k, v] of Object.entries(h)) { if (k !== '_docKey') merged[k] = v; }
  for (const [k, v] of Object.entries(s)) { if (k !== '_docKey') merged[k] = v; }
  showEditor('items_sensible', key, merged, origin || 'completion');
};

function _fieldEmpty(d, fieldId) {
  // L'évènement n'est requis que pour les items du palier Event
  if (fieldId === 'event') return d.palier === 'event' && !(typeof d.event === 'string' && d.event);
  if (fieldId === 'coords') return !d.coords || d.coords.x == null;
  // img et images sont interchangeables : si l'un est rempli, l'autre n'est pas manquant
  if (fieldId === 'img' || fieldId === 'images' || fieldId === 'image') {
    const hasImg    = d.img   != null && d.img   !== '';
    const hasImage  = d.image != null && d.image !== '';
    const hasImages = Array.isArray(d.images) && d.images.length > 0 && d.images.some(x => x != null && x !== '');
    return !hasImg && !hasImage && !hasImages;
  }
  const v = d[fieldId];
  if (v == null || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function _subcatLabel(mode, subcatId) {
  return (QUALITY_SUBCATEGORIES[mode] || []).find(s => s.id === subcatId)?.label || subcatId || null;
}
}
